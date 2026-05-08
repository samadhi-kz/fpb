# Development Notes

This repository uses `main` as the release branch. Feature work should happen on a separate branch, then be merged into `main` through a pull request.

Current working branch:

```sh
git switch feature/test_1
```

Recommended flow:

```sh
git switch main
git pull origin main
git switch -c feature/your-work
```

After implementation:

```sh
git add .
git commit -m "Describe the change"
git push origin feature/your-work
```

Then open a pull request into `main` and merge it after checking the GitHub Pages result.
