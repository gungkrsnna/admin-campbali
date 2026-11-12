import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { ConfirmProvider } from './components/ConfirmDialog'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/Toast'
import './index.css'
import { publishStatusKey } from './lib/publish'
import { Categories } from './pages/Categories'
import { Dashboard } from './pages/Dashboard'
import { faqsConfig, ListEditor, milestonesConfig, testimonialsConfig } from './pages/ListEditor'
import { Login } from './pages/Login'
import { PageText } from './pages/PageText'
import { ProductEdit } from './pages/ProductEdit'
import { Products } from './pages/Products'
import { Publish } from './pages/Publish'
import { Settings } from './pages/Settings'

const queryClient: QueryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  // Every save changes the draft, so the count of unpublished changes is refreshed after it.
  mutationCache: new MutationCache({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: publishStatusKey }),
  }),
})

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'products', element: <Products /> },
      { path: 'products/:id', element: <ProductEdit /> },
      { path: 'categories', element: <Categories /> },
      { path: 'testimonials', element: <ListEditor key="testimonials" config={testimonialsConfig} /> },
      { path: 'faqs', element: <ListEditor key="faqs" config={faqsConfig} /> },
      { path: 'milestones', element: <ListEditor key="milestones" config={milestonesConfig} /> },
      { path: 'pages', element: <PageText /> },
      { path: 'settings', element: <Settings /> },
      { path: 'publish', element: <Publish /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
