import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';

interface ClockInOutRecord {
  _id: string; // Changed from id: number
  staffId: string;
  timestamp: string;
  type: 'clock-in' | 'clock-out';
}

interface WorkTimeRecord {
  _id: string; // Kept as string
  staffId: string;
  name: string;
  date: string;
  clockInTime: string;
  clockOutTime: string;
  totalHours: string;
  keterangan: string;
}

interface AttendanceRecord {
  _id: string; // Changed from id: number
  staffId: string;
  name: string;
  status: string;
  date: string;
  time: string;
}

interface Staff {
  _id: string; // Changed from id: number
  name: string;
}

interface AdminDashboardProps {
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [clockInOutRecords, setClockInOutRecords] = useState<ClockInOutRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [clockInOutSortColumn, setClockInOutSortColumn] = useState<keyof ClockInOutRecord | null>(null);
  const [clockInOutSortDirection, setClockInOutSortDirection] = useState<'asc' | 'desc'>('asc');
  const [clockInOutSearchTerm, setClockInOutSearchTerm] = useState<string>('');

  const [attendanceSortColumn, setAttendanceSortColumn] = useState<keyof AttendanceRecord | null>(null);
  const [attendanceSortDirection, setAttendanceSortDirection] = useState<'asc' | 'desc'>('asc');
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState<string>('');

  const [workTimeRecords, setWorkTimeRecords] = useState<WorkTimeRecord[]>([]);
  const [workTimeSortColumn, setWorkTimeSortColumn] = useState<keyof WorkTimeRecord | null>(null);
  const [workTimeSortDirection, setWorkTimeSortDirection] = useState<'asc' | 'desc'>('asc');
  const [workTimeSearchTerm, setWorkTimeSearchTerm] = useState<string>('');
  const [selectedExportMonth, setSelectedExportMonth] = useState(new Date().getMonth());
  const [selectedExportYear, setSelectedExportYear] = useState(new Date().getFullYear());
  const navigate = useNavigate();

  const handleExport = () => {
    const staffIdParam = selectedStaffId ? `staffId=${selectedStaffId}` : '';
    const monthParam = selectedExportMonth !== -1 ? `month=${selectedExportMonth + 1}` : ''; // Months are 1-indexed in backend
    const yearParam = selectedExportYear !== -1 ? `year=${selectedExportYear}` : '';

    const params = [staffIdParam, monthParam, yearParam].filter(Boolean).join('&');
    const url = `http://localhost:5000/api/export-excel${params ? `?${params}` : ''}`;
    window.open(url, '_blank');
  };

  const handleLogout = () => {
    onLogout();
  };

  useEffect(() => {
    axios.get('http://localhost:5000/api/staff').then((response) => {
      setStaff(response.data);
    });
  }, []);

  useEffect(() => {
    if (selectedStaffId) {
      axios.get(`http://localhost:5000/api/records/${selectedStaffId}`).then((response) => {
        setClockInOutRecords(response.data);
        processWorkTimeRecords(selectedStaffId, response.data, staff);
      });
      axios.get(`http://localhost:5000/api/attendance`).then((response) => {
        const filteredAttendance = response.data.filter((record: AttendanceRecord) => record.staffId === selectedStaffId);
        setAttendanceRecords(filteredAttendance);
      });
    } else {
      setClockInOutRecords([]);
      setAttendanceRecords([]);
      setWorkTimeRecords([]);
    }
  }, [selectedStaffId, staff]);

  const handleClockInOutSort = (column: keyof ClockInOutRecord) => {
    if (clockInOutSortColumn === column) {
      setClockInOutSortDirection(clockInOutSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setClockInOutSortColumn(column);
      setClockInOutSortDirection('asc');
    }
  };

  const handleAttendanceSort = (column: keyof AttendanceRecord) => {
    if (attendanceSortColumn === column) {
      setAttendanceSortDirection(attendanceSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setAttendanceSortColumn(column);
      setAttendanceSortDirection('asc');
    }
  };

  const processWorkTimeRecords = (staffId: string, records: ClockInOutRecord[], allStaff: Staff[]) => {
    const dailyRecords: { [key: string]: ClockInOutRecord[] } = {};
    records.forEach(record => {
      const date = new Date(record.timestamp).toISOString().slice(0, 10);
      if (!dailyRecords[date]) {
        dailyRecords[date] = [];
      }
      dailyRecords[date].push(record);
    });

    const processedRecords: WorkTimeRecord[] = [];
    for (const date in dailyRecords) {
      const recordsForDate = dailyRecords[date].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const clockIn = recordsForDate.find(r => r.type === 'clock-in');
      const clockOut = recordsForDate.reverse().find(r => r.type === 'clock-out');

      let totalHours = 'N/A';
      if (clockIn && clockOut) {
        const startTime = new Date(clockIn.timestamp).getTime();
        const endTime = new Date(clockOut.timestamp).getTime();
        const diffMillis = endTime - startTime;

        const hours = Math.floor(diffMillis / (1000 * 60 * 60));
        const minutes = Math.floor((diffMillis % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor(((diffMillis % (1000 * 60 * 60)) % (1000 * 60)) / 1000);

        totalHours = `${hours} jam ${minutes} menit ${seconds} detik`;
      } else if (clockIn) {
        totalHours = 'Sedang Bekerja';
      }

      if (clockIn || clockOut) {
        let keterangan = '';
        if (clockIn) {
          const clockInDate = new Date(clockIn.timestamp);
          const sevenAM = new Date(clockInDate);
          sevenAM.setHours(7, 0, 0, 0);

          if (clockInDate.getTime() < sevenAM.getTime()) {
            keterangan = 'Datang Lebih Awal';
          } else if (clockInDate.getHours() === 7 && clockInDate.getMinutes() === 0 && clockInDate.getSeconds() === 0) {
            keterangan = 'Tepat Waktu';
          } else {
            keterangan = 'Terlambat';
          }
        }

        processedRecords.push({
          _id: clockIn ? clockIn._id : '',
          staffId: staffId,
          name: allStaff.find(s => s._id === staffId)?.name || 'Unknown',
          date: date,
          clockInTime: clockIn ? new Date(clockIn.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : 'N/A',
          clockOutTime: clockOut ? new Date(clockOut.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : 'N/A',
          totalHours: totalHours,
          keterangan: keterangan,
        });
      }
    }
    setWorkTimeRecords(processedRecords);
  };

  const sortedAttendanceRecords = [...attendanceRecords]
    .filter((a) =>
      a.date.toLowerCase().includes(attendanceSearchTerm.toLowerCase()) ||
      a.status.toLowerCase().includes(attendanceSearchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (attendanceSortColumn === null) return 0;

      const aValue = a[attendanceSortColumn];
      const bValue = b[attendanceSortColumn];

      return attendanceSortDirection === 'asc' ? String(aValue).localeCompare(String(bValue)) : String(bValue).localeCompare(String(aValue));
    });

  const handleWorkTimeSort = (column: keyof WorkTimeRecord) => {
    if (workTimeSortColumn === column) {
      setWorkTimeSortDirection(workTimeSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setWorkTimeSortColumn(column);
      setWorkTimeSortDirection('asc');
    }
  };

  const sortedWorkTimeRecords = [...workTimeRecords]
    .filter((r) =>
      r.name.toLowerCase().includes(workTimeSearchTerm.toLowerCase()) ||
      r.date.toLowerCase().includes(workTimeSearchTerm.toLowerCase()) ||
      r.clockInTime.toLowerCase().includes(workTimeSearchTerm.toLowerCase()) ||
      r.clockOutTime.toLowerCase().includes(workTimeSearchTerm.toLowerCase()) ||
      r.totalHours.toLowerCase().includes(workTimeSearchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (workTimeSortColumn === null) return 0;

      const aValue = a[workTimeSortColumn];
      const bValue = b[workTimeSortColumn];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return workTimeSortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        return workTimeSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      return 0;
    });

  const staffOptions = staff.map(s => ({ value: s._id, label: s.name }));

  return (
    <div>
      <button className="btn btn-danger mb-3" onClick={handleLogout}>Logout</button>
      <h1>Admin Dashboard</h1>
      <div className="d-flex align-items-center mb-3">
        <button className="btn btn-success me-2" onClick={handleExport}>Export to Excel</button>
        <select className="form-select me-2" style={{ width: '130px' }} value={selectedExportMonth} onChange={(e) => setSelectedExportMonth(parseInt(e.target.value))}>
          <option value={-1}>Semua Bulan</option>
          {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((month, index) => (
            <option key={index} value={index}>{month}</option>
          ))}
        </select>
        <select className="form-select" style={{ width: '145px' }} value={selectedExportYear} onChange={(e) => setSelectedExportYear(parseInt(e.target.value))}>
          <option value={-1}>Semua Tahun</option>
          {Array.from(new Set(attendanceRecords.map(a => new Date(a.date).getFullYear()))).map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <h2 className="mt-5">Riwayat Absensi Staff dan Guru</h2>
      <div className="mb-3">
        <label htmlFor="staff-select" className="form-label">Select Staff:</label>
        <Select
          id="staff-select"
          options={staffOptions}
          value={staffOptions.find(option => option.value === selectedStaffId)}
          onChange={(selectedOption) => setSelectedStaffId(selectedOption ? selectedOption.value : null)}
          isClearable
          isSearchable
          placeholder="-- Select or search for a Staff --"
        />
      </div>

      {selectedStaffId && (
        <>
          <h2 className="mt-5">Riwayat Kehadiran</h2>
          <div className="mb-3 mt-3">
            <input
              type="text"
              className="form-control"
              placeholder="Cari riwayat kehadiran..."
              value={attendanceSearchTerm}
              onChange={(e) => setAttendanceSearchTerm(e.target.value)}
            />
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th onClick={() => handleAttendanceSort('name')} style={{ cursor: 'pointer' }}>
                    Nama {attendanceSortColumn === 'name' && (attendanceSortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleAttendanceSort('status')} style={{ cursor: 'pointer' }}>
                    Status {attendanceSortColumn === 'status' && (attendanceSortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleAttendanceSort('date')} style={{ cursor: 'pointer' }}>
                    Tanggal {attendanceSortColumn === 'date' && (attendanceSortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleAttendanceSort('time')} style={{ cursor: 'pointer' }}>
                    Waktu {attendanceSortColumn === 'time' && (attendanceSortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedAttendanceRecords.map((a) => (
                  <tr key={a._id}>
                    <td>{a.name}</td>
                    <td>{a.status}</td>
                    <td>{a.date}</td>
                    <td>{a.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-5">Riwayat Waktu Kerja</h2>
          <div className="mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="Cari riwayat waktu kerja..."
              value={workTimeSearchTerm}
              onChange={(e) => setWorkTimeSearchTerm(e.target.value)}
            />
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th onClick={() => handleWorkTimeSort('name')} style={{ cursor: 'pointer' }}>
                    Nama {workTimeSortColumn === 'name' && (workTimeSortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleWorkTimeSort('date')} style={{ cursor: 'pointer' }}>
                    Tanggal {workTimeSortColumn === 'date' && (workTimeSortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleWorkTimeSort('clockInTime')} style={{ cursor: 'pointer' }}>
                    Jam Masuk {workTimeSortColumn === 'clockInTime' && (workTimeSortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleWorkTimeSort('clockOutTime')} style={{ cursor: 'pointer' }}>
                    Jam Pulang {workTimeSortColumn === 'clockOutTime' && (workTimeSortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleWorkTimeSort('totalHours')} style={{ cursor: 'pointer' }}>
                    Total Jam Kerja {workTimeSortColumn === 'totalHours' && (workTimeSortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleWorkTimeSort('keterangan')} style={{ cursor: 'pointer' }}>
                    Keterangan {workTimeSortColumn === 'keterangan' && (workTimeSortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedWorkTimeRecords.map((record) => (
                  <tr key={record._id}>
                    <td>{record.name}</td>
                    <td>{record.date}</td>
                    <td>{record.clockInTime}</td>
                    <td>{record.clockOutTime}</td>
                    <td>{record.totalHours}</td>
                    <td>{record.keterangan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!selectedStaffId && <p>Please select a staff member to view their attendance records.</p>}
    </div>
  );
};

export default AdminDashboard;