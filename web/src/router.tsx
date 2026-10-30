import { isOverseas } from "@/constant/integration";
import WorkbenchLayout from "@/layouts/workbench-layout";
import { createBrowserRouter, Outlet } from "react-router-dom";

import { AnalyticsTracker } from "@/components/layout/analytics-tracker";
import UserLayout from "@/layouts/user-layout";
import AssetsPage from "@/pages/assets";
import CanvasPage from "@/pages/canvas";
import CanvasProjectPage from "@/pages/canvas/project";
import ConfigPage from "@/pages/config";
import HomePage from "@/pages/home";
import ImagePage from "@/pages/image";
import NotFound from "@/pages/not-found";
import PromptsPage from "@/pages/prompts";
import VideoPage from "@/pages/video";

const pages = [
    { path: "/", element: <HomePage /> },
    { path: "/image", element: <ImagePage /> },
    { path: "/video", element: <VideoPage /> },
    { path: "/assets", element: <AssetsPage /> },
    { path: "/prompts", element: <PromptsPage /> },
    { path: "/canvas", element: <CanvasPage /> },
    { path: "/canvas/:id", element: <CanvasProjectPage /> },
    { path: "/config", element: <ConfigPage /> },
];

export const router = createBrowserRouter([
    {
        element: isOverseas
            ? <WorkbenchLayout><UserLayout><Outlet /></UserLayout></WorkbenchLayout>
            : <UserLayout><AnalyticsTracker /><Outlet /></UserLayout>,
        children: [...pages, ...(isOverseas ? [{ path: "/:id", element: <CanvasProjectPage /> }] : [])],
    },
    { path: "*", element: <NotFound /> },
], { basename: isOverseas ? "/canvas" : "/" });
