import { usePageTransitionLoading } from '@/context/PageTransitionContext'

export function usePageLoader(loading: boolean) {
  usePageTransitionLoading(loading)
}