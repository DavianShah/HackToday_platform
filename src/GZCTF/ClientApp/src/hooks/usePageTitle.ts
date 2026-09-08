import { useDocumentTitle } from '@mantine/hooks'
import { useConfig } from '@Hooks/useConfig'

export const usePageTitle = (title?: string) => {
  const { config, error } = useConfig()

  const platform = error ? 'HackToday' : `${config?.title ?? 'HackToday'}`

  useDocumentTitle(typeof title === 'string' && title.trim().length > 0 ? `${title} - ${platform}` : platform)
}
