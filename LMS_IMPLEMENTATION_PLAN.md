# Integration Plan for React/Spline Components

The current project uses a Python backend with a vanilla HTML/JS frontend. The requested components (`SplineScene`, `Spotlight`, `Card`) are **React components** written in TypeScript (`.tsx`) and require a build system (like Next.js or Vite) to function. They cannot be directly imported into `index.html`.

## Action Plan

1.  **Scaffold React Environment**: I will create a `frontend` folder and initialize a **Next.js** application within it. This will provide the necessary environment for:
    *   TypeScript
    *   Tailwind CSS
    *   React Components

2.  **File Placement**: I will create the component files in the standard `shadcn` structure within the `frontend` directory:
    *   `frontend/components/ui/splite.tsx`
    *   `frontend/components/ui/card.tsx`
    *   `frontend/components/ui/spotlight.tsx` (I will use the Aceternity version as explicitly requested in the first block, or check which one fits the demo. The user provided *both* Aceternity and Ibelick spotlights. I will check the imports in `demo.tsx`. `demo.tsx` imports `Spotlight` from `@/components/ui/spotlight`. I'll need to decide which one or name them differently. The demo uses `<Spotlight className="-top-40..." fill="white" />`. The **Aceternity** spotlight has a `fill` prop. The **Ibelick** one does not (it constructs it). So the demo uses the **Aceternity** spotlight. I will save "aceternity/spotlight" as `spotlight.tsx` and maybe the other as `spotlight-interactive.tsx` or similar if needed, or just follow instructions.)

3.  **Dependencies**: The user listed dependencies to install: `@splinetool/runtime`, `@splinetool/react-spline`, `framer-motion`. I will create a script or instructions to install these.

4.  **Integration**: Since the main app is Python+HTML, this `frontend` app will essentially be a separate "view" or a new version of the frontend.

## Next Steps for You

After I complete the file creation:
1.  Navigate to the `frontend` folder: `cd frontend`
2.  Install dependencies: `npm install`
3.  Install specific libraries: `npm install @splinetool/runtime @splinetool/react-spline framer-motion clsx tailwind-merge`
4.  Run the development server: `npm run dev`
