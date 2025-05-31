// frontend/src/components/UserManagement.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './UserManagement.css';

const UserManagement = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, filterType]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/auth/admin/users/');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by user type
    if (filterType !== 'all') {
      filtered = filtered.filter(user => {
        if (filterType === 'students') return user.is_student;
        if (filterType === 'instructors') return user.is_instructor;
        if (filterType === 'admins') return user.is_staff;
        return true;
      });
    }

    setFilteredUsers(filtered);
  };

  const toggleUserStatus = async (userId, isActive) => {
    try {
      await api.patch(`/auth/admin/users/${userId}/`, { is_active: !isActive });
      fetchUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      await api.delete(`/auth/admin/users/${userId}/`);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="user-management-header">
        <h1>User Management</h1>
        <button 
          onClick={() => navigate('/admin')}
          className="btn btn-secondary"
        >
          Back to Admin
        </button>
      </div>

      <div className="user-management-content">
        <div className="filters-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-buttons">
            <button
              onClick={() => setFilterType('all')}
              className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
            >
              All Users ({users.length})
            </button>
            <button
              onClick={() => setFilterType('students')}
              className={`filter-btn ${filterType === 'students' ? 'active' : ''}`}
            >
              Students ({users.filter(u => u.is_student).length})
            </button>
            <button
              onClick={() => setFilterType('instructors')}
              className={`filter-btn ${filterType === 'instructors' ? 'active' : ''}`}
            >
              Instructors ({users.filter(u => u.is_instructor).length})
            </button>
            <button
              onClick={() => setFilterType('admins')}
              className={`filter-btn ${filterType === 'admins' ? 'active' : ''}`}
            >
              Admins ({users.filter(u => u.is_staff).length})
            </button>
          </div>
        </div>

        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Type</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="user-info">
                      <div className="user-avatar">
                        {user.first_name?.[0] || user.username[0]}
                      </div>
                      <div className="user-details">
                        <div className="user-name">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="username">@{user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <div className="user-types">
                      {user.is_staff && <span className="type-badge admin">Admin</span>}
                      {user.is_instructor && <span className="type-badge instructor">Instructor</span>}
                      {user.is_student && <span className="type-badge student">Student</span>}
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(user.date_joined).toLocaleDateString()}</td>
                  <td>
                    {user.last_login 
                      ? new Date(user.last_login).toLocaleDateString()
                      : 'Never'
                    }
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => toggleUserStatus(user.id, user.is_active)}
                        className={`btn btn-sm ${user.is_active ? 'btn-warning' : 'btn-success'}`}
                      >
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => deleteUser(user.id)}
                        className="btn btn-sm btn-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="no-users">
            <p>No users found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
