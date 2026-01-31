package utils

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// ProgressCallback is a function type for reporting download progress (0-100)
type ProgressCallback func(progress float64)

// DownloadFile downloads a file from the given URL to the specified path.
// It reports progress via the optional onProgress callback.
func DownloadFile(url string, destPath string, onProgress ProgressCallback) error {
	// Ensure directory exists
	dir := filepath.Dir(destPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory %s: %w", dir, err)
	}

	// Use a temp file to avoid leaving partial downloads
	tempPath := destPath + ".downloading"

	// Create output file
	out, err := os.Create(tempPath)
	if err != nil {
		return fmt.Errorf("failed to create file %s: %w", tempPath, err)
	}

	// Cleanup on error
	success := false
	defer func() {
		out.Close()
		if !success {
			os.Remove(tempPath)
		}
	}()

	// Create HTTP client that follows redirects (Go's default does follow, but let's be explicit)
	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return fmt.Errorf("too many redirects")
			}
			return nil
		},
	}

	// Get response
	resp, err := client.Get(url)
	if err != nil {
		return fmt.Errorf("failed to download from %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bad status: %s", resp.Status)
	}

	// Create progress reader
	contentLength := resp.ContentLength

	// If ContentLength is missing (-1), try a HEAD request to get it
	if contentLength <= 0 {
		headResp, err := client.Head(url)
		if err == nil && headResp.StatusCode == http.StatusOK {
			contentLength = headResp.ContentLength
			headResp.Body.Close()
		}
	}

	progressReader := &ProgressReader{
		Reader:     resp.Body,
		Total:      contentLength,
		OnProgress: onProgress,
	}

	// Copy to file
	written, err := io.Copy(out, progressReader)
	if err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	// Verify we got the expected amount of data
	if contentLength > 0 && written != contentLength {
		return fmt.Errorf("incomplete download: got %d bytes, expected %d", written, contentLength)
	}

	// Ensure data is flushed to disk
	if err := out.Sync(); err != nil {
		return fmt.Errorf("failed to sync file: %w", err)
	}
	out.Close()

	// Move temp file to final destination
	if err := os.Rename(tempPath, destPath); err != nil {
		return fmt.Errorf("failed to rename temp file: %w", err)
	}

	success = true
	return nil
}

// ProgressReader wraps an io.Reader to track download progress
type ProgressReader struct {
	Reader     io.Reader
	Total      int64
	ReadSoFar  int64
	OnProgress ProgressCallback
}

func (pr *ProgressReader) Read(p []byte) (int, error) {
	n, err := pr.Reader.Read(p)
	pr.ReadSoFar += int64(n)

	if pr.Total > 0 && pr.OnProgress != nil {
		progress := float64(pr.ReadSoFar) / float64(pr.Total) * 100
		pr.OnProgress(progress)
	}

	return n, err
}

// Unzip extracts a zip archive to a destination directory.
func Unzip(src string, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	if err := os.MkdirAll(dest, 0755); err != nil {
		return err
	}

	// Closure to address file descriptors issue with all the deferred .Close() methods
	extractAndWriteFile := func(f *zip.File) error {
		rc, err := f.Open()
		if err != nil {
			return err
		}
		defer rc.Close()

		path := filepath.Join(dest, f.Name)

		// Check for ZipSlip (Directory traversal)
		if !strings.HasPrefix(path, filepath.Clean(dest)+string(os.PathSeparator)) {
			return fmt.Errorf("illegal file path: %s", path)
		}

		if f.FileInfo().IsDir() {
			os.MkdirAll(path, 0755)
		} else {
			os.MkdirAll(filepath.Dir(path), 0755)
			
			// Try to open file with standard permissions
			f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0755)
			if err != nil {
				// If opening fails, it might be due to existing read-only file
				// Try to remove it first
				os.Remove(path)
				f, err = os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0755)
				if err != nil {
					return err
				}
			}
			defer f.Close()

			_, err = io.Copy(f, rc)
			if err != nil {
				return err
			}
		}
		return nil
	}

	for _, f := range r.File {
		err := extractAndWriteFile(f)
		if err != nil {
			return err
		}
	}

	return nil
}

// UntarGz extracts a .tar.gz archive to a destination directory.
func UntarGz(src string, dest string) error {
	f, err := os.Open(src)
	if err != nil {
		return err
	}
	defer f.Close()

	gzr, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gzr.Close()

	tr := tar.NewReader(gzr)

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		// Clean the header name - remove leading ./ and handle empty names
		name := header.Name
		name = strings.TrimPrefix(name, "./")
		if name == "" || name == "." {
			continue // Skip empty or current directory entries
		}

		target := filepath.Join(dest, name)

		// Check for path traversal (after cleaning)
		cleanDest := filepath.Clean(dest)
		cleanTarget := filepath.Clean(target)
		if !strings.HasPrefix(cleanTarget, cleanDest) {
			return fmt.Errorf("illegal file path: %s", header.Name)
		}

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return err
			}
			outFile, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, os.FileMode(header.Mode)|0755)
			if err != nil {
				return err
			}
			if _, err := io.Copy(outFile, tr); err != nil {
				outFile.Close()
				return err
			}
			outFile.Close()
		case tar.TypeSymlink:
			// Handle symlinks - common in Unix archives
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return err
			}
			os.Remove(target) // Remove existing file/symlink if any
			if err := os.Symlink(header.Linkname, target); err != nil {
				// Symlink might fail on some systems, just skip
				fmt.Printf("Warning: failed to create symlink %s: %v\n", target, err)
			}
		}
	}

	return nil
}
