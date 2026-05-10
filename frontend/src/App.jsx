import AppRouter from './routes/AppRouter';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <AppRouter />
    </>
  );
}

export default App;