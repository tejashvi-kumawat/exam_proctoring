// frontend/src/components/InstructorApproval.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './InstructorApproval.css';

const InstructorApproval = () => {
  const navigate = useNavigate();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [history, setHistory] = useState({ approved: [], rejected: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pendingResponse, historyResponse] = await Promise.all([
        api.get('/auth/admin/pending-instructors/'),
        api.get('/auth/admin/instructor-history/')
      ]);
      
      setPendingRequests(pendingResponse.data);
      setHistory(historyResponse.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const approveInstructor = async (userId) => {
    try {
      await api.post(`/auth/admin/approve-instructor/${userId}/`);
      alert('Instructor approved successfully!');
      fetchData();
    } catch (error) {
      console.error('Error approving instructor:', error);
      alert('Failed to approve instructor');
    }
  };

  const rejectInstructor = async (userId) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      await api.post(`/auth/admin/reject-instructor/${userId}/`, { reason });
      alert('Instructor request rejected');
      fetchData();
    } catch (error) {
      console.error('Error rejecting instructor:', error);
      alert('Failed to reject instructor');
    }
  };

  if (loading) {
    return <div className="loading-container">Loading...</div>;
  }

  return (
    <div className="instructor-approval">
      <div className="approval-header">
        <h1>Instructor Approval Management</h1>
        <button onClick={() => navigate('/admin')} className="btn btn-secondary">
          Back to Admin
        </button>
      </div>

      <div className="approval-tabs">
        <button 
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Requests ({pendingRequests.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Approval History
        </button>
      </div>

      {activeTab === 'pending' && (
        <div className="pending-requests">
          <h2>Pending Instructor Requests</h2>
          {pendingRequests.length === 0 ? (
            <p>No pending requests</p>
          ) : (
            <div className="requests-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Requested Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map(user => (
                    <tr key={user.id}>
                      <td>{user.first_name} {user.last_name}</td>
                      <td>{user.username}</td>
                      <td>{user.email}</td>
                      <td>{user.phone_number || 'N/A'}</td>
                      <td>{new Date(user.approval_requested_at).toLocaleDateString()}</td>
                      <td>
                        <button 
                          onClick={() => approveInstructor(user.id)}
                          className="btn btn-success btn-sm"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => rejectInstructor(user.id)}
                          className="btn btn-danger btn-sm"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="approval-history">
          <div className="history-section">
            <h3>Approved Instructors ({history.approved.length})</h3>
            {history.approved.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Approved Date</th>
                    <th>Approved By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.approved.map(user => (
                    <tr key={user.id}>
                      <td>{user.first_name} {user.last_name}</td>
                      <td>{user.username}</td>
                      <td>{user.email}</td>
                      <td>{new Date(user.approved_at).toLocaleDateString()}</td>
                      <td>{user.approved_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="history-section">
            <h3>Rejected Requests ({history.rejected.length})</h3>
            {history.rejected.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Rejected Date</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {history.rejected.map(user => (
                    <tr key={user.id}>
                      <td>{user.first_name} {user.last_name}</td>
                      <td>{user.username}</td>
                      <td>{user.email}</td>
                      <td>{new Date(user.rejected_at).toLocaleDateString()}</td>
                      <td>{user.rejection_reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InstructorApproval;
