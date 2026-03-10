# Video – Front-end beta tester struggles demo

A small React app built to demonstrate **intentionally bad UX** for a video about front-end beta tester struggles.

## What’s “wrong” on purpose

- **Popup**
  - Opens on load and **does not close** when you:
    - Click the overlay
    - Press Escape
    - Click the big “Close” button (it does nothing)
  - **Only closes** when you click a **4×4px invisible hitbox** at the bottom-left of the modal.
- **Accessibility**
  - Navigation is plain `div`s with `onClick`, not links or buttons.
  - Confusing labels: “Close” and “Skip” change pages; “Main” and “Home” both go “home”.
  - No landmarks, no `role="dialog"`, no focus trap, empty/absent `aria-label` on the real close control.
- **Navigation**
  - Unclear what each item does; “Close” doesn’t close the popup, it changes the page.

## Run it

```bash
cd video
npm install
npm run dev
```

Open the URL Vite prints (e.g. http://localhost:5173).
