import { useParams, useLocation } from 'react-router-dom'
import CourseEditor from '../components/course/CourseEditor'
import AiAssistant from '../components/common/AiAssistant'

const EDITOR_SUGGESTIONS = [
  'How do I add a new block?',
  'How do I reorder components?',
  'How do I publish my course?',
]

export default function EditorPage() {
  const { id } = useParams()
  const location = useLocation()
  const state = location.state as any

  return (
    <>
      <CourseEditor
        courseId={id || 'new-course'}
        initialTitle={state?.title}
        initialDescription={state?.description}
        initialTheme={state?.theme}
        initialMenu={state?.menu}
      />
      <AiAssistant context="Course Editor" suggestions={EDITOR_SUGGESTIONS} />
    </>
  )
}
