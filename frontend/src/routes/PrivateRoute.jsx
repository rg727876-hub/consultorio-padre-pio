import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function PrivateRoute({ children, roles }) {
    const { user, loading } = useContext(AuthContext);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
        );
    }

    if (!user) return <Navigate to="/login" />;
    if (roles && !roles.includes(user.rol)) return <Navigate to="/dashboard" />;

    return children;
}