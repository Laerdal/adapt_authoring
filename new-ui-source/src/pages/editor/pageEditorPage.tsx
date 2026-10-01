import { useLocation, useParams } from 'react-router-dom'
import AiAssistant from '../../components/common/AiAssistant'
import PageEditorWorkspace from './pageEditorWorkspace'

const EDITOR_SUGGESTIONS = [
  'How do I add a new block?',
  'How do I reorder components?',
  'How do I publish my course?',
]

type EditorNavigationState = {
  courseId?: string
  title?: string
  description?: string
  theme?: string
  menu?: string
  pageId?: string
}

export default function PageEditorPage() {
  const { id } = useParams()
  const location = useLocation()
  const state = (location.state as EditorNavigationState | null) ?? null

  return (
    <>
      <PageEditorWorkspace
        courseId={id || 'new-course'}
        initialTitle={state?.title}
        initialDescription={state?.description}
        initialTheme={state?.theme}
        initialMenu={state?.menu}
        initialPageId={state?.pageId}
      />
      <AiAssistant context="Course Editor" suggestions={EDITOR_SUGGESTIONS} />
    </>
  )
}
