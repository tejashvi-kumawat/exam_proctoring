// frontend/src/components/Reports.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Reports.css';

const Reports = () => {
  const navigate = useNavigate();
  const [reportType, setReportType] = useState('exam-summary');
  const [dateRange, setDateRange] = useState({
    start_date: '',
    end_date: ''
  });
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateReport = async () => {
    if (!dateRange.start_date || !dateRange.end_date) {
      setError('Please select both start and end dates');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/exam/admin/reports/', {
        report_type: reportType,
        ...dateRange
      });
      setReportData(response.data);
    } catch (error) {
      console.error('Error generating report:', error);
      setError('Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = (format) => {
    if (!reportData) {
      setError('No report data to export');
      return;
    }
    
    const params = new URLSearchParams({
      report_type: reportType,
      format: format,
      ...dateRange
    });
    
    window.open(`/api/exam/admin/reports/export/?${params}`, '_blank');
  };

  const renderReportContent = () => {
    if (!reportData) return null;

    switch (reportType) {
      case 'exam-summary':
        return (
          <div className="report-summary">
            <h3>Exam Summary Report</h3>
            <div className="summary-stats">
              <div className="stat-item">
                <span className="stat-label">Total Exams:</span>
                <span className="stat-value">{reportData.total_exams || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total Attempts:</span>
                <span className="stat-value">{reportData.total_attempts || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Average Score:</span>
                <span className="stat-value">{reportData.average_score || 0}%</span>
              </div>
            </div>
          </div>
        );
      
      case 'student-performance':
        return (
          <div className="performance-report">
            <h3>Student Performance Report</h3>
            {reportData.students && reportData.students.length > 0 ? (
              <table className="performance-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Exams Taken</th>
                    <th>Average Score</th>
                    <th>Best Score</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.students.map((student, index) => (
                    <tr key={student.id || index}>
                      <td>{student.name}</td>
                      <td>{student.exams_taken}</td>
                      <td>{student.average_score}%</td>
                      <td>{student.best_score}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No student performance data available.</p>
            )}
          </div>
        );
      
      default:
        return (
          <div className="raw-report">
            <h3>Report Data</h3>
            <pre className="report-json">
              {JSON.stringify(reportData, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <div className="reports">
      <div className="reports-header">
        <h1>Reports & Analytics</h1>
        <button 
          onClick={() => navigate('/admin')}
          className="btn btn-secondary"
        >
          Back to Admin
        </button>
      </div>

      <div className="reports-content">
        <div className="report-controls">
          <div className="controls-section">
            <div className="form-group">
              <label htmlFor="reportType">Report Type</label>
              <select
                id="reportType"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="form-control"
              >
                <option value="exam-summary">Exam Summary</option>
                <option value="student-performance">Student Performance</option>
                <option value="violation-report">Violation Report</option>
                <option value="usage-statistics">Usage Statistics</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="startDate">Start Date</label>
                <input
                  id="startDate"
                  type="date"
                  value={dateRange.start_date}
                  onChange={(e) => setDateRange(prev => ({
                    ...prev,
                    start_date: e.target.value
                  }))}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="endDate">End Date</label>
                <input
                  id="endDate"
                  type="date"
                  value={dateRange.end_date}
                  onChange={(e) => setDateRange(prev => ({
                    ...prev,
                    end_date: e.target.value
                  }))}
                  className="form-control"
                />
              </div>
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="report-actions">
              <button
                onClick={generateReport}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </button>

              {reportData && (
                <div className="export-buttons">
                  <button
                    onClick={() => exportReport('pdf')}
                    className="btn btn-secondary"
                  >
                    📄 Export PDF
                  </button>
                  <button
                    onClick={() => exportReport('excel')}
                    className="btn btn-secondary"
                  >
                    📊 Export Excel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {reportData && (
          <div className="report-results">
            <h2>Report Results</h2>
            {renderReportContent()}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
