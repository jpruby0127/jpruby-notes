import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import { AdminGate } from "@/admin/admin-gate";
import { AdminLayout } from "@/admin/admin-layout";
import { PublicLayout } from "@/components/public-layout";
import { AboutPage } from "@/pages/about-page";
import { AdminCommentsPage } from "@/pages/admin/comments-page";
import { AdminEditorPage } from "@/pages/admin/editor-page";
import { AdminPostsPage } from "@/pages/admin/posts-page";
import { AdminSettingsPage } from "@/pages/admin/settings-page";
import { HomePage } from "@/pages/home-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { PostPage } from "@/pages/post-page";

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="posts/:slug" element={<PostPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="/admin" element={<AdminGate />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminPostsPage />} />
            <Route path="posts/new" element={<AdminEditorPage />} />
            <Route path="posts/:id/edit" element={<AdminEditorPage />} />
            <Route path="comments" element={<AdminCommentsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
