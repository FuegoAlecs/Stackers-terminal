import { useState, useEffect } from 'react'

interface UseFetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

function useFetch<T>(url: string): UseFetchState<T> {
  const [state, setState] = useState<UseFetchState<T>>({
    data: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }))
        const response = await fetch(url)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        setState({ data, loading: false, error: null })
      } catch (error) {
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        })
      }
    }

    fetchData()
  }, [url])

  return state
}

export default useFetch