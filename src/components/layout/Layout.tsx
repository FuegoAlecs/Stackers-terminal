import React from 'react'
import { cn } from '../../lib/utils'

interface LayoutProps {
  children: React.ReactNode
  className?: string
}

interface HeaderProps {
  children: React.ReactNode
  className?: string
}

interface MainProps {
  children: React.ReactNode
  className?: string
}

interface FooterProps {
  children: React.ReactNode
  className?: string
}

const Layout: React.FC<LayoutProps> = ({ children, className }) => {
  return (
    <div className={cn('min-h-screen bg-gray-50', className)}>
      {children}
    </div>
  )
}

const Header: React.FC<HeaderProps> = ({ children, className }) => {
  return (
    <header className={cn('bg-white shadow-sm border-b', className)}>
      {children}
    </header>
  )
}

const Main: React.FC<MainProps> = ({ children, className }) => {
  return (
    <main className={cn('flex-1', className)}>
      {children}
    </main>
  )
}

const Footer: React.FC<FooterProps> = ({ children, className }) => {
  return (
    <footer className={cn('bg-white border-t', className)}>
      {children}
    </footer>
  )
}

export { Layout, Header, Main, Footer }