import { lazy, Suspense } from "react";
import { Spin } from "antd";
import { isOverseas } from "@/constant/integration";
import WorkbenchLayout from "@/layouts/workbench-layout";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";

import { AnalyticsTracker } from "@/components/layout/analytics-tracker";
import UserLayout from "@/layouts/user-layout";
const AssetsPage = lazy(() => import("@/pages/assets"));
const CanvasPage = lazy(() => import("@/pages/canvas"));
const CanvasProjectPage = lazy(() => import("@/pages/canvas/project"));
const ConfigPage = lazy(() => import("@/pages/config"));
const HomePage = lazy(() => import("@/pages/home"));
const ImagePage = lazy(() => import("@/pages/image"));
const NotFound = lazy(() => import("@/pages/not-found"));
const PromptsPage = lazy(() => import("@/pages/prompts"));
const VideoPage = lazy(() => import("@/pages/video"));

const pages = [
    { path: "/", element: isOverseas ? <Navigate to="/canvas" replace /> : <HomePage /> },
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
            ? <WorkbenchLayout><UserLayout><Suspense fallback={<div className="flex h-full items-center justify-center"><Spin /></div>}><Outlet /></Suspense></UserLayout></WorkbenchLayout>
            : <UserLayout><AnalyticsTracker /><Suspense fallback={<div className="flex h-full items-center justify-center"><Spin /></div>}><Outlet /></Suspense></UserLayout>,
        children: [...pages, ...(isOverseas ? [{ path: "/:id", element: <CanvasProjectPage /> }] : [])],
    },
    { path: "*", element: <Suspense fallback={null}><NotFound /></Suspense> },
], { basename: isOverseas ? "/canvas" : "/" });
