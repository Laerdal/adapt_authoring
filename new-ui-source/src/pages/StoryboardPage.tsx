// Storyboard Authoring page — full-screen route wrapper (ADAPT-3760).
// Thin route wrapper around the reusable <StoryboardWorkspace/>, which is also
// embedded in the Course Configuration "Storyboard" panel.

import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { StoryboardWorkspace } from '@/components/storyboard';
import { getCourseBootstrapData } from '@/api/adaptAuthoring';

export default function StoryboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const stateTitle = (location.state as { title?: string } | null)?.title;
  // The caller doesn't always pass the course title via navigation state —
  // fall back to the same source of truth every other screen uses so this
  // route never shows a stale/placeholder title.
  const [courseTitle, setCourseTitle] = useState(stateTitle);

  useEffect(() => {
    if (stateTitle || !id) return;
    let cancelled = false;
    getCourseBootstrapData(id)
      .then((data) => {
        if (!cancelled) setCourseTitle(data.displayTitle || data.title);
      })
      .catch(() => {
        /* fall back to StoryboardWorkspace's own default */
      });
    return () => {
      cancelled = true;
    };
  }, [id, stateTitle]);

  return (
    <div className="h-screen">
      <StoryboardWorkspace
        courseId={id}
        courseTitle={courseTitle}
        onBack={() => navigate(`/course/${id ?? ''}`)}
      />
    </div>
  );
}
