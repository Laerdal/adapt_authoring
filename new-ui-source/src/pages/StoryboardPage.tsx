// Storyboard Authoring page — full-screen route wrapper (ADAPT-3760).
// Thin route wrapper around the reusable <StoryboardWorkspace/>, which is also
// embedded in the Course Configuration "Storyboard" panel.

import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { StoryboardWorkspace } from '@/components/storyboard';

export default function StoryboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const courseTitle = (location.state as { title?: string } | null)?.title;

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
