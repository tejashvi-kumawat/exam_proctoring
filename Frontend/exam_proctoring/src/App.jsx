// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ExamProvider } from './contexts/ExamContext';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import ExamInterface from './components/ExamInterface';
import ProctoringSetup from './components/ProctoringSetup';
import ExamResults from './components/ExamResults';
import AdminPanel from './components/AdminPanel';
import QuestionManager from './components/QuestionManager';
import ExamMonitor from './components/ExamMonitor';
import CreateExam from './components/CreateExam';
import UserManagement from './components/UserManagement';
import Reports from './components/Reports';
import AttemptDetails from './components/AttemptDetails';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import InstructorApproval from './components/InstructorApproval';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <ExamProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Protected Student Routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/exam/:examId/setup" element={
                <ProtectedRoute>
                  <ProctoringSetup />
                </ProtectedRoute>
              } />
              <Route path="/exam/:examId/interface" element={
                <ProtectedRoute>
                  <ExamInterface />
                </ProtectedRoute>
              } />
              <Route path="/exam/results/:attemptId" element={
                <ProtectedRoute>
                  <ExamResults />
                </ProtectedRoute>
              } />
              
              {/* Admin Routes */}
              <Route path="/admin" element={
                <AdminRoute>
                  <AdminPanel />
                </AdminRoute>
              } />
              <Route path="/admin/instructor-approval" element={
                <AdminRoute>
                  <InstructorApproval />
                </AdminRoute>
              } />
              <Route path="/admin/questions" element={
                <AdminRoute>
                  <QuestionManager />
                </AdminRoute>
              } />
              <Route path="/admin/monitor" element={
                <AdminRoute>
                  <ExamMonitor />
                </AdminRoute>
              } />
              <Route path="/admin/create-exam" element={
                <AdminRoute>
                  <CreateExam />
                </AdminRoute>
              } />
              <Route path="/admin/users" element={
                <AdminRoute>
                  <UserManagement />
                </AdminRoute>
              } />
              <Route path="/admin/reports" element={
                <AdminRoute>
                  <Reports />
                </AdminRoute>
              } />
              <Route path="/admin/attempt/:attemptId" element={
                <AdminRoute>
                  <AttemptDetails />
                </AdminRoute>
              } />
              
              {/* Default Route */}
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
          </div>
        </Router>
      </ExamProvider>
    </AuthProvider>
  );
}

export default App;
