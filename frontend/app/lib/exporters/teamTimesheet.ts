import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

interface TimesheetEntry {
  date: string;
  type: "timesheet" | "leave";
  status: string;
  employee?: string;
  task?: string;
  title?: string; // For HR team-member-timesheet
  leaveType?: string;
  hours?: number;
  mode?: string;
  description?: string;
  fromDate?: string;
  toDate?: string;
  submittedAt?: string;
  rejectionReason?: string;
}

export function exportTeamTimesheetToExcel(
  filename: string,
  entries: TimesheetEntry[],
  teamMemberName?: string
) {
  // Prepare data for Excel
  const excelData = entries.map((entry) => {
    const date = entry.date ? new Date(entry.date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) : '';
    
    // Handle both 'task' and 'title' fields
    const taskOrTitle = entry.type === 'timesheet' 
      ? (entry.task || entry.title || '') 
      : (entry.leaveType || '');
    
    return {
      'Date': date,
      'Type': entry.type === 'timesheet' ? 'Timesheet' : 'Leave',
      'Status': entry.status || '',
      'Employee': entry.employee || teamMemberName || '',
      'Task/Leave Type': taskOrTitle,
      'Hours': entry.hours !== undefined ? (entry.hours > 0 ? entry.hours : (entry.type === 'leave' ? '-' : '0')) : (entry.type === 'leave' ? '-' : '0'),
      'Work Location': entry.mode || '',
      'From Date': entry.fromDate ? new Date(entry.fromDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }) : '',
      'To Date': entry.toDate ? new Date(entry.toDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }) : '',
      'Description': entry.description || '',
      'Submitted At': entry.submittedAt ? new Date(entry.submittedAt).toLocaleString('en-GB') : '',
      'Rejection Reason': entry.rejectionReason || '',
    };
  });

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  const colWidths = [
    { wch: 12 }, // Date
    { wch: 12 }, // Type
    { wch: 12 }, // Status
    { wch: 20 }, // Employee
    { wch: 30 }, // Task/Leave Type
    { wch: 10 }, // Hours
    { wch: 15 }, // Work Location
    { wch: 12 }, // From Date
    { wch: 12 }, // To Date
    { wch: 40 }, // Description
    { wch: 20 }, // Submitted At
    { wch: 30 }, // Rejection Reason
  ];
  ws['!cols'] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Timesheet & Leave Data');

  // Generate Excel file and download
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportTeamTimesheetToPDF(
  filename: string,
  entries: TimesheetEntry[],
  teamMemberName?: string
) {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const startY = 20;
  let yPos = startY;
  const lineHeight = 7;
  const maxY = pageHeight - margin;

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Team Timesheet & Leave Management', margin, yPos);
  yPos += lineHeight + 2;

  if (teamMemberName) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Team Member: ${teamMemberName}`, margin, yPos);
    yPos += lineHeight + 2;
  }

  // Table headers
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const headers = ['Date', 'Type', 'Status', 'Task/Leave', 'Hours', 'Location'];
  const colWidths = [25, 20, 20, 50, 20, 30];
  let xPos = margin;

  // Draw header row
  headers.forEach((header, index) => {
    doc.rect(xPos, yPos - 5, colWidths[index], lineHeight + 2);
    doc.text(header, xPos + 2, yPos);
    xPos += colWidths[index];
  });
  yPos += lineHeight + 4;

  // Table data
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  entries.forEach((entry) => {
    // Check if we need a new page
    if (yPos > maxY - lineHeight) {
      doc.addPage();
      yPos = startY;
    }

    const date = entry.date ? new Date(entry.date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) : '';
    
    const taskOrTitle = entry.type === 'timesheet' 
      ? (entry.task || entry.title || '')
      : (entry.leaveType || '');
    
    const type = entry.type === 'timesheet' ? 'Timesheet' : 'Leave';
    const status = entry.status || '';
    const hours = entry.hours !== undefined 
      ? (entry.hours > 0 ? entry.hours.toString() : (entry.type === 'leave' ? '-' : '0'))
      : (entry.type === 'leave' ? '-' : '0');
    const location = entry.mode || '';

    const rowData = [date, type, status, taskOrTitle.substring(0, 30), hours, location];
    xPos = margin;

    rowData.forEach((data, index) => {
      doc.rect(xPos, yPos - 5, colWidths[index], lineHeight + 2);
      doc.text(data, xPos + 2, yPos);
      xPos += colWidths[index];
    });
    yPos += lineHeight + 2;

    // Add rejection reason below the row if status is Rejected and rejection reason exists
    if (status === 'Rejected' && entry.rejectionReason) {
      // Check if we need a new page for the rejection reason
      if (yPos > maxY - lineHeight) {
        doc.addPage();
        yPos = startY;
      }
      
      const totalWidth = colWidths.reduce((sum, width) => sum + width, 0);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      const rejectionText = `Rejection Reason: ${entry.rejectionReason}`;
      // Split long text into multiple lines if needed
      const maxWidth = totalWidth - 4;
      const splitText = doc.splitTextToSize(rejectionText, maxWidth);
      
      splitText.forEach((line: string) => {
        if (yPos > maxY - lineHeight) {
          doc.addPage();
          yPos = startY;
        }
        doc.text(line, margin + 2, yPos);
        yPos += lineHeight;
      });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      yPos += 2; // Add small spacing after rejection reason
    }
  });

  // Save PDF
  doc.save(`${filename}.pdf`);
}

