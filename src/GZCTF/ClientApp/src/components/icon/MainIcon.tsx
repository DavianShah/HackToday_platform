import { StyleProp, rem } from '@mantine/core'
import { FC, ImgHTMLAttributes } from 'react'
import logoUrl from '../../assets/logo.png'

export interface MainIconProps {
  ignoreTheme?: boolean
  size?: StyleProp<React.CSSProperties['width']>
}

export const MainIcon: FC<MainIconProps & Omit<ImgHTMLAttributes<HTMLImageElement>, 'size'>> = ({
  ignoreTheme,
  size,
  ...imgProps
}) => {
  void ignoreTheme

  return (
    <img
      src={logoUrl}
      alt="HackToday"
      draggable={false}
      style={{
        marginLeft: `calc(${rem(size)} / 10)`,
        width: rem(size) || 'auto',
        height: 'auto',
        display: 'block',
      }}
      {...imgProps}
    />
  )
}
