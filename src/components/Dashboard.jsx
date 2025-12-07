import React, { useState } from 'react';
import './dashboard.css';

const Dashboard = () => {
    const [dashboardData, setDashboardData] = useState({
        totalClass: 0, totalFaculty: 0, totalSubjects: 0, totalClassrooms: 0, timetablesCreated: 0
    });
    const [activePanel, setActivePanel] = useState(null);

    // Data lists
    const [facultyList, setFacultyList] = useState([{ id: 1, name: 'Dr. Faculity', department: 'CSE' }]);
    const [classList, setClassList] = useState([{ id: 1, className: 'CSE-A', roomNo: 'A-101' }]);
    const [subjectList, setSubjectList] = useState([{ id: 1, subject: 'Data Structures', branch: 'CSE', semester: '5th' }]);
    const [roomList, setRoomList] = useState([{ id: 1, roomNo: 'A-101', branch: 'CSE', capacity: 60 }]);

    // Form states
    const [facultyForm, setFacultyForm] = useState({ name: '', department: '', email: '', phone: '' });
    const [classForm, setClassForm] = useState({ className: '', roomNo: '' });
    const [subjectForm, setSubjectForm] = useState({ subject: '', branch: '', semester: '' });
    const [roomForm, setRoomForm] = useState({ roomNo: '', branch: '', capacity: '' });

    const engineeringBranches = ['CSE', 'ECE', 'ME', 'CE', 'EEE', 'DS', 'ISE', 'AI&ML'];
    const semesters = ['1st(P-Cycle)', '2nd(C-Cycle)', '3rd', '4th', '5th', '6th', '7th', '8th'];

    const updateDashboard = (type) => {
        setDashboardData(prev => ({
            ...prev,
            [type === 'faculty' ? 'totalFaculty' : type === 'class' ? 'totalClass' :
                type === 'subject' ? 'totalSubjects' : 'totalClassrooms']: prev[type === 'faculty' ? 'totalFaculty' : type === 'class' ? 'totalClass' :
                    type === 'subject' ? 'totalSubjects' : 'totalClassrooms'] + 1
        }));
    };

    const handleSubmit = (e, type) => {
        e.preventDefault();

        const newId = type === 'faculty' ? facultyList.length + 1 :
            type === 'class' ? classList.length + 1 :
                type === 'subject' ? subjectList.length + 1 :
                    roomList.length + 1;

        if (type === 'faculty') {
            setFacultyList([...facultyList, { id: newId, ...facultyForm }]);
            setFacultyForm({ name: '', department: '', email: '', phone: '' });
        } else if (type === 'class') {
            setClassList([...classList, { id: newId, ...classForm }]);
            setClassForm({ className: '', roomNo: '' });
        } else if (type === 'subject') {
            setSubjectList([...subjectList, { id: newId, ...subjectForm }]);
            setSubjectForm({ subject: '', branch: '', semester: '' });
        } else if (type === 'room') {
            setRoomList([...roomList, { id: newId, ...roomForm }]);
            setRoomForm({ roomNo: '', branch: '', capacity: '' });
        }

        updateDashboard(type);
        alert(`${type.charAt(0).toUpperCase() + type.slice(1)} added successfully!`);
    };

    const CustomSelect = ({ options, value, onChange, label, id }) => (
        <div className="form-group">
            <label>{label}</label>
            <div className="custom-select-container">
                <select id={id} value={value} onChange={onChange} required>
                    <option value="">Select {label}</option>
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <span className="select-icon">▼</span>
            </div>
        </div>
    );

    const renderDataList = (type) => {
        if (type === 'faculty') {
            return facultyList.map(item => (
                <div key={item.id} className="list-item">
                    <strong>{item.name}</strong> - {item.department} | {item.email || 'No Email'} | {item.phone || 'No Phone'}
                </div>
            ));
        } else if (type === 'class') {
            return classList.map(item => (
                <div key={item.id} className="list-item">
                    <strong>{item.className}</strong> - Room: {item.roomNo}
                </div>
            ));
        } else if (type === 'subject') {
            return subjectList.map(item => (
                <div key={item.id} className="list-item">
                    <strong>{item.subject}</strong> - {item.branch}, Sem: {item.semester}
                </div>
            ));
        } else if (type === 'room') {
            return roomList.map(item => (
                <div key={item.id} className="list-item">
                    <strong>{item.roomNo}</strong> - {item.branch} (Capacity: {item.capacity || 'N/A'})
                </div>
            ));
        }
        return null;
    };

    const overviewData = [
        { id: 1, title: 'Total Class', count: dashboardData.totalClass,color: '#FF6B6B', panel: 'class' },
        { id: 2, title: 'Total Faculty', count: dashboardData.totalFaculty, color: '#4ECDC4', panel: 'faculty' },
        { id: 3, title: 'Total Subjects', count: dashboardData.totalSubjects, color: '#45B7D1', panel: 'subject' },
        { id: 4, title: 'Class Rooms/Labs', count: dashboardData.totalClassrooms, color: '#96CEB4', panel: 'room' },
        { id: 5, title: 'Timetables Created', count: dashboardData.timetablesCreated, color: '#FFEAA7' },
    ];

    const renderPanel = () => {
        const panels = {
            faculty: (
                <>
                    <form onSubmit={(e) => handleSubmit(e, 'faculty')} className="data-entry-form">
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Name *</label>
                                <input required value={facultyForm.name} onChange={(e) => setFacultyForm({ ...facultyForm, name: e.target.value })} placeholder="Dr. John Smith" />
                            </div>
                            <div className="form-group">
                                <label>Department *</label>
                                <input required value={facultyForm.department} onChange={(e) => setFacultyForm({ ...facultyForm, department: e.target.value })} placeholder="CSE" />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input type="email" value={facultyForm.email} onChange={(e) => setFacultyForm({ ...facultyForm, email: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Phone</label>
                                <input type="tel" value={facultyForm.phone} onChange={(e) => setFacultyForm({ ...facultyForm, phone: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="submit-btn">➕ Add Faculty</button>
                            <button type="button" className="cancel-btn" onClick={() => setActivePanel(null)}>Cancel</button>
                        </div>
                    </form>
                    <div className="data-list-container">
                        <h3>Existing Faculty</h3>
                        {renderDataList('faculty')}
                    </div>
                </>
            ),
            class: (
                <>
                    <form onSubmit={(e) => handleSubmit(e, 'class')} className="data-entry-form">
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Class Name *</label>
                                <input required value={classForm.className} onChange={(e) => setClassForm({ ...classForm, className: e.target.value })} placeholder="CSE-A" />
                            </div>
                            <div className="form-group">
                                <label>Room No/Lab *</label>
                                <input required value={classForm.roomNo} onChange={(e) => setClassForm({ ...classForm, roomNo: e.target.value })} placeholder="A-101" />
                            </div>
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="submit-btn">➕ Add Class</button>
                            <button type="button" className="cancel-btn" onClick={() => setActivePanel(null)}>Cancel</button>
                        </div>
                    </form>
                    <div className="data-list-container">
                        <h3>Existing Classes</h3>
                        {renderDataList('class')}
                    </div>
                </>
            ),
            subject: (
                <>
                    <form onSubmit={(e) => handleSubmit(e, 'subject')} className="data-entry-form">
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Subject Name *</label>
                                <input required value={subjectForm.subject} onChange={(e) => setSubjectForm({ ...subjectForm, subject: e.target.value })} placeholder="Data Structures" />
                            </div>
                            <CustomSelect options={engineeringBranches} value={subjectForm.branch} onChange={(e) => setSubjectForm({ ...subjectForm, branch: e.target.value })} label="Branch *" id="branch" />
                            <CustomSelect options={semesters} value={subjectForm.semester} onChange={(e) => setSubjectForm({ ...subjectForm, semester: e.target.value })} label="Semester *" id="semester" />
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="submit-btn">➕ Add Subject</button>
                            <button type="button" className="cancel-btn" onClick={() => setActivePanel(null)}>Cancel</button>
                        </div>
                    </form>
                    <div className="data-list-container">
                        <h3>Existing Subjects</h3>
                        {renderDataList('subject')}
                    </div>
                </>
            ),
            room: (
                <>
                    <form onSubmit={(e) => handleSubmit(e, 'room')} className="data-entry-form">
                        <div className="form-grid">
                            <CustomSelect options={engineeringBranches} value={roomForm.branch} onChange={(e) => setRoomForm({ ...roomForm, branch: e.target.value })} label="Branch *" id="room-branch" />
                            <div className="form-group">
                                <label>Room No *</label>
                                <input required value={roomForm.roomNo} onChange={(e) => setRoomForm({ ...roomForm, roomNo: e.target.value })} placeholder="A-101" />
                            </div>
                            <div className="form-group">
                                <label>Lab No *</label>
                                <input required value={roomForm.roomNo} onChange={(e) => setRoomForm({ ...roomForm, roomNo: e.target.value })} placeholder="A-101" />
                            </div>
                            <div className="form-group">
                                <label>Capacity</label>
                                <input type="number" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} placeholder="60" />
                            </div>
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="submit-btn">➕ Add Room</button>
                            <button type="button" className="cancel-btn" onClick={() => setActivePanel(null)}>Cancel</button>
                        </div>
                    </form>
                    <div className="data-list-container">
                        <h3>Existing Rooms</h3>
                        {renderDataList('room')}
                    </div>
                </>
            )
        };
        return panels[activePanel];
    };

    return (
        <div className="dashboard-wrapper">
            {/* Left Sidebar */}
            <nav className="sidebar-nav">
                <div className="nav-header">
                    <p>Super admin & Admin Panel</p>
                    <hr />
                </div>
                <ul className="nav-list">
                    <li><a className="nav-item active"><span></span> Home</a></li>
                    <li><a className="nav-item" onClick={() => window.location.href = "/TimetableGenerator"}> Create New TimeTable</a></li>
                    <li><a className="nav-item" onClick={() => ('subject')}><span></span> Profile</a></li>
                    <li><a className="nav-item" onClick={() => ('room')}><span></span> Settings</a></li>
                    <li><a className="nav-item" onClick={() => ('room')}><span></span> Help</a></li>
                    <li><a className="nav-item logout" onClick={() => window.location.href = "/login"}>Logout</a></li>
                </ul>
            </nav>

            {/* Main Content */}
            <main className="dashboard-content">
                <div className="content-header">
                    <h1>Dashboard</h1>
                    <p>Real-time updates with engineering branches & semesters</p>
                </div>

                {/* Stats Cards */}
                <div className="stats-panel">
                    <div className="panel-header">
                        <h2>Statistics</h2>
                    </div>
                    <div className="cards-flex">
                        {overviewData.map(item => (
                            <div className="panel-card" key={item.id} style={{ '--card-color': item.color }}>
                                <div className="card-header">
                                    <div className="card-icon">{item.icon}</div>
                                </div>
                                <div className="card-body">
                                    <h3>{item.title}</h3>
                                    <div className="count">{item.count}</div>
                                </div>
                                <div className="card-footer">
                                    <button className="details-btn" onClick={() => item.panel && setActivePanel(item.panel)}>
                                        {item.panel ? 'Add New →' : 'View Tables Created →'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Data Entry Panel */}
                {activePanel && (
                    <div className="data-entry-panel">
                        <div className="panel-header">
                            <h2>{activePanel === 'class' ? '📚 Add Class' : activePanel === 'faculty' ? '👨‍🏫 Add Faculty' :
                                activePanel === 'subject' ? '📖 Add Subject' : '🏛️ Add Room'}</h2>
                            <button className="close-btn" onClick={() => setActivePanel(null)}>✕</button>
                        </div>
                        {renderPanel()}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
