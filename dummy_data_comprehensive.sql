-- =============================================================================
-- COMPREHENSIVE DUMMY DATA FOR TIMESHEET SYSTEM
-- Date: 30/11/2025
-- Users: SK001 (Developer), E00196 (Technical Admin)
-- Team: T03
-- =============================================================================

-- Note: Assumes leave_type_master, task_type_master, user_master, team_master already exist
-- Common leave types assumed: LT001 (Casual), LT002 (Sick), LT003 (Annual), LT004 (Compensatory), LT005 (Permission)
-- Common task types assumed: TT001-TT012
-- Common status codes: STS001 (Not Yet Started), STS007 (In Progress), STS002 (Completed), STS010 (Cancelled)
-- Common priority codes: 1 (Low), 2 (Medium), 3 (High) - Note: Using only 1, 2, 3 as 4 may not exist
-- Common product codes: P0001, P0002, P0003 (assumed to exist in sts_new.product_master)

DO $$
DECLARE
    -- Predefined Epic IDs (will be captured after insertion)
    v_predef_epic1_id INTEGER;
    v_predef_epic2_id INTEGER;
    v_predef_epic3_id INTEGER;
    
    -- Epic IDs (will be captured after insertion)
    v_epic1_id INTEGER;
    v_epic2_id INTEGER;
    v_epic3_id INTEGER;
    v_epic4_id INTEGER;
    
    -- Task IDs (will be captured after insertion)
    v_task1_id INTEGER;
    v_task2_id INTEGER;
    v_task3_id INTEGER;
    v_task4_id INTEGER;
    v_task5_id INTEGER;
    v_task6_id INTEGER;
    v_task7_id INTEGER;
    v_task8_id INTEGER;
    v_task9_id INTEGER;
    v_task10_id INTEGER;
    
    -- Activity IDs
    v_activity1_id INTEGER;
    v_activity2_id INTEGER;
    v_activity3_id INTEGER;
    
    -- Leave Application IDs
    v_leave1_id INTEGER;
    v_leave2_id INTEGER;
    v_leave3_id INTEGER;
    v_leave4_id INTEGER;
    v_leave5_id INTEGER;
    v_leave6_id INTEGER;
    v_leave7_id INTEGER;
    v_leave8_id INTEGER;
    v_leave9_id INTEGER;
    v_leave10_id INTEGER;
    
    -- Timesheet Entry IDs (will be captured)
    v_ts_entry_id INTEGER;
BEGIN

-- =============================================================================
-- 1. PREDEFINED EPICS (Templates)
-- =============================================================================
INSERT INTO sts_ts.predefined_epics (
    title, description, contact_person_code, priority_code, 
    estimated_hours, max_hours, is_billable, is_active, 
    created_by, created_at
) VALUES 
(
    'E-Commerce Platform Development',
    'Complete e-commerce platform with shopping cart, payment integration, and order management',
    NULL, 3, 200.00, 250.00, true, true, 'E00196', '2025-10-15 10:00:00'
),
(
    'Mobile App Redesign',
    'Redesign existing mobile application with modern UI/UX and new features',
    NULL, 2, 150.00, 180.00, true, true, 'E00196', '2025-10-20 11:00:00'
),
(
    'API Integration Project',
    'Integrate third-party APIs for payment processing and shipping',
    NULL, 3, 80.00, 100.00, true, true, 'E00196', '2025-11-01 09:00:00'
);

-- Get predefined epic IDs
SELECT id INTO v_predef_epic1_id FROM sts_ts.predefined_epics WHERE title = 'E-Commerce Platform Development' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_predef_epic2_id FROM sts_ts.predefined_epics WHERE title = 'Mobile App Redesign' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_predef_epic3_id FROM sts_ts.predefined_epics WHERE title = 'API Integration Project' ORDER BY id DESC LIMIT 1;

-- =============================================================================
-- 2. PREDEFINED TASKS (Templates)
-- =============================================================================
INSERT INTO sts_ts.predefined_tasks (
    task_title, task_description, status_code, priority_code, 
    work_mode, team_code, estimated_hours, max_hours, is_billable, 
    created_by, created_at
) VALUES 
(
    'Advanced Database Schema Design',
    'Design and implement complex database schema for new feature with relationships and constraints',
    'STS001', 3, 'REMOTE', 'T03', 16.00, 20.00, true, 'E00196', '2025-10-15 10:30:00'
),
(
    'React Component Library Development',
    'Develop reusable React component library for user interface with TypeScript',
    'STS001', 2, 'OFFICE', 'T03', 24.00, 30.00, true, 'E00196', '2025-10-15 11:00:00'
),
(
    'REST API Endpoint Testing Suite',
    'Write comprehensive test cases and execute testing for REST API endpoints',
    'STS001', 3, 'REMOTE', 'T03', 12.00, 15.00, true, 'E00196', '2025-11-01 09:30:00'
);

-- =============================================================================
-- 3. ACTIVITIES (Standalone activities not tied to epics)
-- =============================================================================
INSERT INTO sts_ts.activities (
    activity_title, activity_description, product_code, is_billable, 
    created_by, created_at, updated_by, updated_at
) VALUES 
(
    'Code Review Session',
    'Review code changes and provide feedback to team members',
    'P0001', true, 'E00196', '2025-11-25 14:00:00', NULL, NULL
),
(
    'Team Training on New Framework',
    'Conduct training session on new JavaScript framework',
    'P0001', false, 'E00196', '2025-11-20 10:00:00', NULL, NULL
),
(
    'Client Meeting - Requirements Discussion',
    'Discuss new requirements and project scope with client',
    'P0002', true, 'E00196', '2025-11-28 15:00:00', NULL, NULL
);

-- Get activity IDs
SELECT id INTO v_activity1_id FROM sts_ts.activities WHERE activity_title = 'Code Review Session' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_activity2_id FROM sts_ts.activities WHERE activity_title = 'Team Training on New Framework' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_activity3_id FROM sts_ts.activities WHERE activity_title = 'Client Meeting - Requirements Discussion' ORDER BY id DESC LIMIT 1;

-- =============================================================================
-- 4. EPICS (Actual projects) - Capture IDs
-- =============================================================================
INSERT INTO sts_ts.epics (
    epic_title, epic_description, product_code, company_code, contact_person_code,
    reporter, predefined_epic_id, status_code, priority_code,
    start_date, due_date, closed_on, estimated_hours, max_hours, is_billable,
    cancelled_by, cancelled_at, cancellation_reason,
    created_by, created_at, updated_by, updated_at
) VALUES 
(
    'Customer Portal Enhancement',
    'Enhance existing customer portal with new features and improved UI',
    'P0001', NULL, NULL, 'E00196', NULL, 'STS007', 3,
    '2025-11-01', '2025-12-15', NULL, 120.00, 150.00, true,
    NULL, NULL, NULL,
    'E00196', '2025-11-01 09:00:00', NULL, NULL
),
(
    'Payment Gateway Integration',
    'Integrate new payment gateway provider for better transaction processing',
    'P0001', NULL, NULL, 'E00196', v_predef_epic3_id, 'STS007', 3,
    '2025-11-10', '2025-12-05', NULL, 60.00, 80.00, true,
    NULL, NULL, NULL,
    'E00196', '2025-11-10 10:00:00', NULL, NULL
),
(
    'Performance Optimization',
    'Optimize application performance and reduce load times',
    'P0002', NULL, NULL, 'E00196', NULL, 'STS002', 2,
    '2025-10-20', '2025-11-25', '2025-11-25', 40.00, 50.00, true,
    NULL, NULL, NULL,
    'E00196', '2025-10-20 11:00:00', 'E00196', '2025-11-25 17:00:00'
),
(
    'Security Audit and Fixes',
    'Conduct security audit and fix identified vulnerabilities',
    'P0001', NULL, NULL, 'E00196', NULL, 'STS001', 3,
    '2025-11-28', '2025-12-20', NULL, 80.00, 100.00, true,
    NULL, NULL, NULL,
    'E00196', '2025-11-28 09:00:00', NULL, NULL
);

-- Get epic IDs
SELECT id INTO v_epic1_id FROM sts_ts.epics WHERE epic_title = 'Customer Portal Enhancement' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_epic2_id FROM sts_ts.epics WHERE epic_title = 'Payment Gateway Integration' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_epic3_id FROM sts_ts.epics WHERE epic_title = 'Performance Optimization' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_epic4_id FROM sts_ts.epics WHERE epic_title = 'Security Audit and Fixes' ORDER BY id DESC LIMIT 1;

-- =============================================================================
-- 5. EPIC HISTORY (Track epic changes)
-- =============================================================================
INSERT INTO sts_ts.epic_hist (
    epic_code, status_code, status_reason, user_code, reporter, priority_code,
    product_code, start_date, due_date, closed_on, estimated_hours, max_hours,
    cancelled_by, cancelled_at, created_by, created_at
) VALUES 
-- Epic 1: Customer Portal Enhancement - Status changes
(v_epic1_id, 'STS001', 'Epic created', NULL, 'E00196', 3, 'P0001', '2025-11-01', '2025-12-15', NULL, 120.00, 150.00, NULL, NULL, 'E00196', '2025-11-01 09:00:00'),
(v_epic1_id, 'STS007', 'Development started', NULL, 'E00196', 3, 'P0001', '2025-11-01', '2025-12-15', NULL, 120.00, 150.00, NULL, NULL, 'E00196', '2025-11-05 10:00:00'),

-- Epic 2: Payment Gateway Integration - Status changes
(v_epic2_id, 'STS001', 'Epic created', NULL, 'E00196', 3, 'P0001', '2025-11-10', '2025-12-05', NULL, 60.00, 80.00, NULL, NULL, 'E00196', '2025-11-10 10:00:00'),
(v_epic2_id, 'STS007', 'Integration in progress', NULL, 'E00196', 3, 'P0001', '2025-11-10', '2025-12-05', NULL, 60.00, 80.00, NULL, NULL, 'E00196', '2025-11-12 14:00:00'),

-- Epic 3: Performance Optimization - Completed
(v_epic3_id, 'STS001', 'Epic created', NULL, 'E00196', 2, 'P0002', '2025-10-20', '2025-11-25', NULL, 40.00, 50.00, NULL, NULL, 'E00196', '2025-10-20 11:00:00'),
(v_epic3_id, 'STS007', 'Optimization started', NULL, 'E00196', 2, 'P0002', '2025-10-20', '2025-11-25', NULL, 40.00, 50.00, NULL, NULL, 'E00196', '2025-10-22 09:00:00'),
(v_epic3_id, 'STS002', 'Optimization completed successfully', NULL, 'E00196', 2, 'P0002', '2025-10-20', '2025-11-25', '2025-11-25', 40.00, 50.00, NULL, NULL, 'E00196', '2025-11-25 17:00:00'),

-- Epic 4: Security Audit - Just created
(v_epic4_id, 'STS001', 'Epic created', NULL, 'E00196', 3, 'P0001', '2025-11-28', '2025-12-20', NULL, 80.00, 100.00, NULL, NULL, 'E00196', '2025-11-28 09:00:00');

-- =============================================================================
-- 6. TASKS (Tasks within epics) - Capture IDs
-- =============================================================================
INSERT INTO sts_ts.tasks (
    task_title, description, epic_code, predefined_task_id, product_code,
    assignee, reporter, assigned_team_code, status_code, priority_code,
    task_type_code, work_mode, assigned_on, start_date, due_date, closed_on,
    estimated_hours, max_hours, is_billable,
    cancelled_by, cancelled_at, cancellation_reason,
    created_by, created_at, updated_by, updated_at
) VALUES 
-- Epic 1: Customer Portal Enhancement - Tasks
(
    'Design New Dashboard UI',
    'Create wireframes and mockups for enhanced dashboard interface',
    v_epic1_id, NULL, 'P0001', 'SK001', 'E00196', 'T03', 'STS007', 3,
    'TT007', 'OFFICE', '2025-11-02', '2025-11-03', '2025-11-15', NULL,
    20.00, 25.00, true, NULL, NULL, NULL,
    'E00196', '2025-11-02 10:00:00', NULL, NULL
),
(
    'Implement User Profile Section',
    'Develop user profile page with edit functionality',
    v_epic1_id, NULL, 'P0001', 'SK001', 'E00196', 'T03', 'STS007', 2,
    'TT002', 'REMOTE', '2025-11-05', '2025-11-06', '2025-12-05', NULL,
    16.00, 20.00, true, NULL, NULL, NULL,
    'E00196', '2025-11-05 09:00:00', NULL, NULL
),
(
    'Add Notification System',
    'Implement real-time notification system for user alerts',
    v_epic1_id, NULL, 'P0001', 'SK001', 'E00196', 'T03', 'STS001', 3,
    'TT002', 'OFFICE', '2025-11-25', '2025-11-28', '2025-12-10', NULL,
    24.00, 30.00, true, NULL, NULL, NULL,
    'E00196', '2025-11-25 11:00:00', NULL, NULL
),

-- Epic 2: Payment Gateway Integration - Tasks
(
    'Setup Payment Gateway API',
    'Configure and setup new payment gateway provider API',
    v_epic2_id, NULL, 'P0001', 'E00196', 'E00196', 'T03', 'STS007', 3,
    'TT011', 'REMOTE', '2025-11-11', '2025-11-12', '2025-11-25', NULL,
    12.00, 15.00, true, NULL, NULL, NULL,
    'E00196', '2025-11-11 10:00:00', NULL, NULL
),
(
    'Implement Payment Processing',
    'Develop payment processing logic and error handling',
    v_epic2_id, NULL, 'P0001', 'E00196', 'E00196', 'T03', 'STS007', 3,
    'TT002', 'OFFICE', '2025-11-15', '2025-11-16', '2025-11-30', NULL,
    20.00, 25.00, true, NULL, NULL, NULL,
    'E00196', '2025-11-15 09:00:00', NULL, NULL
),
(
    'Test Payment Integration',
    'Write and execute test cases for payment gateway integration',
    v_epic2_id, NULL, 'P0001', 'E00196', 'E00196', 'T03', 'STS001', 3,
    'TT003', 'REMOTE', '2025-11-28', '2025-12-01', '2025-12-05', NULL,
    8.00, 10.00, true, NULL, NULL, NULL,
    'E00196', '2025-11-28 14:00:00', NULL, NULL
),

-- Epic 3: Performance Optimization - Tasks (assigned to E00196, not SK001)
(
    'Database Query Optimization',
    'Optimize slow database queries and add indexes',
    v_epic3_id, NULL, 'P0002', 'E00196', 'E00196', 'T03', 'STS002', 2,
    'TT002', 'REMOTE', '2025-10-21', '2025-10-22', '2025-11-10', '2025-11-10',
    16.00, 20.00, true, NULL, NULL, NULL,
    'E00196', '2025-10-21 10:00:00', 'E00196', '2025-11-10 16:00:00'
),
(
    'Frontend Bundle Optimization',
    'Reduce JavaScript bundle size and improve loading times',
    v_epic3_id, NULL, 'P0002', 'E00196', 'E00196', 'T03', 'STS002', 2,
    'TT002', 'OFFICE', '2025-10-25', '2025-10-26', '2025-11-20', '2025-11-20',
    12.00, 15.00, true, NULL, NULL, NULL,
    'E00196', '2025-10-25 11:00:00', 'E00196', '2025-11-20 15:00:00'
),

-- Epic 4: Security Audit - Tasks
(
    'Security Vulnerability Scan',
    'Run automated security scanning tools to identify vulnerabilities',
    v_epic4_id, NULL, 'P0001', 'E00196', 'E00196', 'T03', 'STS001', 3,
    'TT003', 'REMOTE', '2025-11-28', '2025-11-29', '2025-12-05', NULL,
    8.00, 10.00, true, NULL, NULL, NULL,
    'E00196', '2025-11-28 10:00:00', NULL, NULL
),
(
    'Fix SQL Injection Vulnerabilities',
    'Identify and fix potential SQL injection vulnerabilities',
    v_epic4_id, NULL, 'P0001', 'SK001', 'E00196', 'T03', 'STS001', 3,
    'TT002', 'OFFICE', '2025-11-29', '2025-12-01', '2025-12-15', NULL,
    24.00, 30.00, true, NULL, NULL, NULL,
    'E00196', '2025-11-29 09:00:00', NULL, NULL
);

-- Get task IDs
SELECT id INTO v_task1_id FROM sts_ts.tasks WHERE task_title = 'Design New Dashboard UI' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_task2_id FROM sts_ts.tasks WHERE task_title = 'Implement User Profile Section' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_task3_id FROM sts_ts.tasks WHERE task_title = 'Add Notification System' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_task4_id FROM sts_ts.tasks WHERE task_title = 'Setup Payment Gateway API' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_task5_id FROM sts_ts.tasks WHERE task_title = 'Implement Payment Processing' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_task6_id FROM sts_ts.tasks WHERE task_title = 'Test Payment Integration' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_task7_id FROM sts_ts.tasks WHERE task_title = 'Database Query Optimization' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_task8_id FROM sts_ts.tasks WHERE task_title = 'Frontend Bundle Optimization' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_task9_id FROM sts_ts.tasks WHERE task_title = 'Security Vulnerability Scan' ORDER BY id DESC LIMIT 1;
-- Note: v_task7_id and v_task8_id are kept for E00196's timesheet entries
SELECT id INTO v_task10_id FROM sts_ts.tasks WHERE task_title = 'Fix SQL Injection Vulnerabilities' ORDER BY id DESC LIMIT 1;

-- =============================================================================
-- 7. TASK HISTORY (Track task changes)
-- =============================================================================
INSERT INTO sts_ts.task_hist (
    task_code, status_code, priority_code, task_type_code, status_reason,
    product_code, assigned_team_code, assignee, reporter, work_mode,
    assigned_on, start_date, due_date, closed_on, estimated_hours, max_hours,
    cancelled_by, cancelled_at, created_by, created_at
) VALUES 
-- Task 1: Design New Dashboard UI
(v_task1_id, 'STS001', 3, 'TT007', 'Task created', 'P0001', 'T03', 'SK001', 'E00196', 'OFFICE', '2025-11-02', '2025-11-03', '2025-11-15', NULL, 20.00, 25.00, NULL, NULL, 'E00196', '2025-11-02 10:00:00'),
(v_task1_id, 'STS007', 3, 'TT007', 'Design work started', 'P0001', 'T03', 'SK001', 'E00196', 'OFFICE', '2025-11-02', '2025-11-03', '2025-11-15', NULL, 20.00, 25.00, NULL, NULL, 'SK001', '2025-11-05 09:00:00'),

-- Task 2: Implement User Profile Section
(v_task2_id, 'STS001', 2, 'TT002', 'Task created', 'P0001', 'T03', 'SK001', 'E00196', 'REMOTE', '2025-11-05', '2025-11-06', '2025-12-05', NULL, 16.00, 20.00, NULL, NULL, 'E00196', '2025-11-05 09:00:00'),
(v_task2_id, 'STS007', 2, 'TT002', 'Development started', 'P0001', 'T03', 'SK001', 'E00196', 'REMOTE', '2025-11-05', '2025-11-06', '2025-12-05', NULL, 16.00, 20.00, NULL, NULL, 'SK001', '2025-11-08 10:00:00'),

-- Task 3: Add Notification System
(v_task3_id, 'STS001', 3, 'TT002', 'Task created', 'P0001', 'T03', 'SK001', 'E00196', 'OFFICE', '2025-11-25', '2025-11-28', '2025-12-10', NULL, 24.00, 30.00, NULL, NULL, 'E00196', '2025-11-25 11:00:00'),

-- Task 4: Setup Payment Gateway API
(v_task4_id, 'STS001', 3, 'TT011', 'Task created', 'P0001', 'T03', 'E00196', 'E00196', 'REMOTE', '2025-11-11', '2025-11-12', '2025-11-25', NULL, 12.00, 15.00, NULL, NULL, 'E00196', '2025-11-11 10:00:00'),
(v_task4_id, 'STS007', 3, 'TT011', 'API setup in progress', 'P0001', 'T03', 'E00196', 'E00196', 'REMOTE', '2025-11-11', '2025-11-12', '2025-11-25', NULL, 12.00, 15.00, NULL, NULL, 'E00196', '2025-11-13 14:00:00'),

-- Task 5: Implement Payment Processing
(v_task5_id, 'STS001', 3, 'TT002', 'Task created', 'P0001', 'T03', 'E00196', 'E00196', 'OFFICE', '2025-11-15', '2025-11-16', '2025-11-30', NULL, 20.00, 25.00, NULL, NULL, 'E00196', '2025-11-15 09:00:00'),
(v_task5_id, 'STS007', 3, 'TT002', 'Development started', 'P0001', 'T03', 'E00196', 'E00196', 'OFFICE', '2025-11-15', '2025-11-16', '2025-11-30', NULL, 20.00, 25.00, NULL, NULL, 'E00196', '2025-11-18 10:00:00'),

-- Task 6: Test Payment Integration
(v_task6_id, 'STS001', 3, 'TT003', 'Task created', 'P0001', 'T03', 'E00196', 'E00196', 'REMOTE', '2025-11-28', '2025-12-01', '2025-12-05', NULL, 8.00, 10.00, NULL, NULL, 'E00196', '2025-11-28 14:00:00'),

-- Task 7: Database Query Optimization (Completed - assigned to E00196)
-- Task 8: Frontend Bundle Optimization (Completed - assigned to E00196)
-- Note: Task 7 and 8 are now assigned to E00196, not SK001, so they won't appear in SK001's dashboard

-- Task 9: Security Vulnerability Scan
(v_task9_id, 'STS001', 3, 'TT003', 'Task created', 'P0001', 'T03', 'E00196', 'E00196', 'REMOTE', '2025-11-28', '2025-11-29', '2025-12-05', NULL, 8.00, 10.00, NULL, NULL, 'E00196', '2025-11-28 10:00:00'),

-- Task 10: Fix SQL Injection Vulnerabilities
(v_task10_id, 'STS001', 3, 'TT002', 'Task created', 'P0001', 'T03', 'SK001', 'E00196', 'OFFICE', '2025-11-29', '2025-12-01', '2025-12-15', NULL, 24.00, 30.00, NULL, NULL, 'E00196', '2025-11-29 09:00:00');

-- =============================================================================
-- 8. LEAVE APPLICATIONS (For SK001 and E00196)
-- =============================================================================
INSERT INTO sts_ts.leave_application (
    user_code, leave_type_code, from_date, to_date, duration_days, duration_hours,
    reason, approval_status, approved_by, approved_at, rejected_by, rejected_at,
    rejection_reason, created_by, created_at, updated_by, updated_at
) VALUES 
-- SK001 Leave Applications
-- Note: Changed some leaves to SUBMITTED status to test pending approval workflow
(
    'SK001', 'LT001', '2025-11-15', '2025-11-16', 2, 16,
    'Personal work at home', 'SUBMITTED', NULL, NULL,
    NULL, NULL, NULL, 'SK001', '2025-11-13 10:00:00', NULL, NULL
),
(
    'SK001', 'LT005', '2025-11-20', '2025-11-20', 0.5, 4,
    'Medical appointment', 'SUBMITTED', NULL, NULL,
    NULL, NULL, NULL, 'SK001', '2025-11-18 14:00:00', NULL, NULL
),
(
    'SK001', 'LT002', '2025-11-25', '2025-11-26', 2, 16,
    'Sick leave - fever', 'SUBMITTED', NULL, NULL,
    NULL, NULL, NULL, 'SK001', '2025-11-24 09:00:00', NULL, NULL
),
(
    'SK001', 'LT003', '2025-12-05', '2025-12-07', 3, 24,
    'Annual leave for family vacation', 'DRAFT', NULL, NULL,
    NULL, NULL, NULL, 'SK001', '2025-11-28 11:00:00', NULL, NULL
),
(
    'SK001', 'LT001', '2025-11-28', '2025-11-28', 1, 8,
    'Personal work - half day', 'SUBMITTED', NULL, NULL,
    NULL, NULL, NULL, 'SK001', '2025-11-27 14:00:00', NULL, NULL
),
(
    'SK001', 'LT002', '2025-11-29', '2025-11-29', 1, 8,
    'Sick leave - not feeling well', 'SUBMITTED', NULL, NULL,
    NULL, NULL, NULL, 'SK001', '2025-11-29 10:00:00', NULL, NULL
),
-- Keep one approved leave for testing
(
    'SK001', 'LT001', '2025-11-26', '2025-11-26', 1, 8,
    'Personal work - approved leave', 'APPROVED', 'E00196', '2025-11-25 16:00:00',
    NULL, NULL, NULL, 'SK001', '2025-11-25 14:00:00', NULL, NULL
),

-- E00196 Leave Applications
(
    'E00196', 'LT001', '2025-11-10', '2025-11-10', 1, 8,
    'Personal work', 'APPROVED', NULL, NULL,
    NULL, NULL, NULL, 'E00196', '2025-11-08 10:00:00', NULL, NULL
),
(
    'E00196', 'LT005', '2025-11-22', '2025-11-22', 0.5, 4,
    'Half day for personal work', 'APPROVED', NULL, NULL,
    NULL, NULL, NULL, 'E00196', '2025-11-21 09:00:00', NULL, NULL
),
(
    'E00196', 'LT004', '2025-12-10', '2025-12-10', 1, 8,
    'Compensatory leave for working on weekend', 'DRAFT', NULL, NULL,
    NULL, NULL, NULL, 'E00196', '2025-11-29 15:00:00', NULL, NULL
);

-- Get leave application IDs (for attachments later)
SELECT id INTO v_leave1_id FROM sts_ts.leave_application WHERE user_code = 'SK001' AND from_date = '2025-11-15' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_leave2_id FROM sts_ts.leave_application WHERE user_code = 'SK001' AND from_date = '2025-11-20' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_leave3_id FROM sts_ts.leave_application WHERE user_code = 'SK001' AND from_date = '2025-11-25' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_leave4_id FROM sts_ts.leave_application WHERE user_code = 'SK001' AND from_date = '2025-12-05' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_leave5_id FROM sts_ts.leave_application WHERE user_code = 'SK001' AND from_date = '2025-11-28' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_leave6_id FROM sts_ts.leave_application WHERE user_code = 'SK001' AND from_date = '2025-11-29' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_leave7_id FROM sts_ts.leave_application WHERE user_code = 'SK001' AND from_date = '2025-11-26' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_leave8_id FROM sts_ts.leave_application WHERE user_code = 'E00196' AND from_date = '2025-11-10' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_leave9_id FROM sts_ts.leave_application WHERE user_code = 'E00196' AND from_date = '2025-11-22' ORDER BY id DESC LIMIT 1;
SELECT id INTO v_leave10_id FROM sts_ts.leave_application WHERE user_code = 'E00196' AND from_date = '2025-12-10' ORDER BY id DESC LIMIT 1;

-- =============================================================================
-- 9. TIMESHEET ENTRIES (For SK001 and E00196) - Using captured IDs
-- =============================================================================
-- Note: Timesheet entries will be inserted and their IDs captured for approval history
-- For brevity, showing key entries. In production, you'd capture each entry_id

INSERT INTO sts_ts.timesheet_entry (
    task_code, epic_code, activity_code, entry_date, user_code, approval_status,
    actual_hours_worked, travel_time, waiting_time, total_hours, work_location,
    task_type_code, description, submitted_by, submitted_at, approved_by, approved_at,
    rejected_by, rejected_at, rejection_reason, created_by, created_at, updated_by, updated_at
) VALUES 
-- SK001 Timesheet Entries (Task-based)
-- November 2025 entries
(v_task1_id, v_epic1_id, NULL, '2025-11-03', 'SK001', 'APPROVED', 6.0, 0.0, 0.0, 6.0, 'OFFICE', 'TT007', 'Worked on dashboard UI design mockups', 'SK001', '2025-11-03 18:00:00', 'E00196', '2025-11-04 09:00:00', NULL, NULL, NULL, 'SK001', '2025-11-03 09:00:00', NULL, NULL),
(v_task1_id, v_epic1_id, NULL, '2025-11-04', 'SK001', 'APPROVED', 7.5, 0.0, 0.0, 7.5, 'OFFICE', 'TT007', 'Continued dashboard design and created wireframes', 'SK001', '2025-11-04 18:00:00', 'E00196', '2025-11-05 09:00:00', NULL, NULL, NULL, 'SK001', '2025-11-04 09:00:00', NULL, NULL),
(v_task1_id, v_epic1_id, NULL, '2025-11-05', 'SK001', 'APPROVED', 6.5, 0.0, 0.0, 6.5, 'OFFICE', 'TT007', 'Finalized dashboard design and prepared for development', 'SK001', '2025-11-05 17:30:00', 'E00196', '2025-11-06 09:00:00', NULL, NULL, NULL, 'SK001', '2025-11-05 09:00:00', NULL, NULL),

(v_task2_id, v_epic1_id, NULL, '2025-11-06', 'SK001', 'APPROVED', 8.0, 0.0, 0.0, 8.0, 'REMOTE', 'TT002', 'Started implementing user profile section', 'SK001', '2025-11-06 18:00:00', 'E00196', '2025-11-07 09:00:00', NULL, NULL, NULL, 'SK001', '2025-11-06 09:00:00', NULL, NULL),
(v_task2_id, v_epic1_id, NULL, '2025-11-07', 'SK001', 'APPROVED', 7.0, 0.0, 0.0, 7.0, 'REMOTE', 'TT002', 'Developed profile edit functionality', 'SK001', '2025-11-07 17:00:00', 'E00196', '2025-11-08 09:00:00', NULL, NULL, NULL, 'SK001', '2025-11-07 09:00:00', NULL, NULL),
(v_task2_id, v_epic1_id, NULL, '2025-11-08', 'SK001', 'APPROVED', 6.5, 0.0, 0.0, 6.5, 'REMOTE', 'TT002', 'Added validation and error handling for profile updates', 'SK001', '2025-11-08 16:30:00', 'E00196', '2025-11-09 09:00:00', NULL, NULL, NULL, 'SK001', '2025-11-08 09:00:00', NULL, NULL),

-- Recent entries (last 7 days: 24/11 to 30/11) - Adjusted to match dashboard
-- 25/11: 2.5h (APPROVED)
(NULL, NULL, v_activity1_id, '2025-11-25', 'SK001', 'APPROVED', 2.5, 0.0, 0.0, 2.5, 'REMOTE', NULL, 'Code review session', 'SK001', '2025-11-25 18:00:00', 'E00196', '2025-11-26 09:00:00', NULL, NULL, NULL, 'SK001', '2025-11-25 14:00:00', NULL, NULL),

-- 28/11: 5.5h (SUBMITTED - PENDING)
(v_task3_id, v_epic1_id, NULL, '2025-11-28', 'SK001', 'SUBMITTED', 5.5, 0.0, 0.0, 5.5, 'OFFICE', 'TT002', 'Started working on notification system', 'SK001', '2025-11-28 18:00:00', NULL, NULL, NULL, NULL, NULL, 'SK001', '2025-11-28 09:00:00', NULL, NULL),

-- 29/11: 3.5h (SUBMITTED - PENDING)
(v_task3_id, v_epic1_id, NULL, '2025-11-29', 'SK001', 'SUBMITTED', 3.5, 0.0, 0.0, 3.5, 'OFFICE', 'TT002', 'Continued notification system development', 'SK001', '2025-11-29 18:00:00', NULL, NULL, NULL, NULL, NULL, 'SK001', '2025-11-29 09:00:00', NULL, NULL),

-- 30/11: 4.5h (SUBMITTED - PENDING)
(v_task10_id, v_epic4_id, NULL, '2025-11-30', 'SK001', 'SUBMITTED', 4.5, 0.0, 0.0, 4.5, 'OFFICE', 'TT002', 'Started security audit task', 'SK001', '2025-11-30 18:00:00', NULL, NULL, NULL, NULL, NULL, 'SK001', '2025-11-30 09:00:00', NULL, NULL),

-- E00196 Timesheet Entries
(v_task4_id, v_epic2_id, NULL, '2025-11-12', 'E00196', 'APPROVED', 6.0, 0.0, 0.0, 6.0, 'REMOTE', 'TT011', 'Setup payment gateway API credentials', 'E00196', '2025-11-12 18:00:00', NULL, NULL, NULL, NULL, NULL, 'E00196', '2025-11-12 10:00:00', NULL, NULL),
(v_task4_id, v_epic2_id, NULL, '2025-11-13', 'E00196', 'APPROVED', 7.5, 0.0, 0.0, 7.5, 'REMOTE', 'TT011', 'Configured payment gateway webhooks', 'E00196', '2025-11-13 17:30:00', NULL, NULL, NULL, NULL, NULL, 'E00196', '2025-11-13 10:00:00', NULL, NULL),

(v_task5_id, v_epic2_id, NULL, '2025-11-16', 'E00196', 'APPROVED', 8.0, 0.0, 0.0, 8.0, 'OFFICE', 'TT002', 'Developed payment processing logic', 'E00196', '2025-11-16 18:00:00', NULL, NULL, NULL, NULL, NULL, 'E00196', '2025-11-16 09:00:00', NULL, NULL),
(v_task5_id, v_epic2_id, NULL, '2025-11-18', 'E00196', 'APPROVED', 7.0, 0.0, 0.0, 7.0, 'OFFICE', 'TT002', 'Implemented error handling for payment failures', 'E00196', '2025-11-18 17:00:00', NULL, NULL, NULL, NULL, NULL, 'E00196', '2025-11-18 09:00:00', NULL, NULL),
(v_task5_id, v_epic2_id, NULL, '2025-11-19', 'E00196', 'APPROVED', 6.5, 0.0, 0.0, 6.5, 'OFFICE', 'TT002', 'Added payment retry mechanism', 'E00196', '2025-11-19 16:30:00', NULL, NULL, NULL, NULL, NULL, 'E00196', '2025-11-19 09:00:00', NULL, NULL),

(v_task6_id, v_epic2_id, NULL, '2025-11-28', 'E00196', 'DRAFT', 4.0, 0.0, 0.0, 4.0, 'REMOTE', 'TT003', 'Started writing test cases for payment integration', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'E00196', '2025-11-28 14:00:00', NULL, NULL),
(v_task9_id, v_epic4_id, NULL, '2025-11-29', 'E00196', 'DRAFT', 3.5, 0.0, 0.0, 3.5, 'REMOTE', 'TT003', 'Ran security vulnerability scan', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'E00196', '2025-11-29 10:00:00', NULL, NULL),
(v_task9_id, v_epic4_id, NULL, '2025-11-30', 'E00196', 'DRAFT', 5.0, 0.0, 0.0, 5.0, 'REMOTE', 'TT003', 'Analyzed security scan results', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'E00196', '2025-11-30 09:00:00', NULL, NULL),

-- E00196 Activity-based entries
(NULL, NULL, v_activity1_id, '2025-11-25', 'E00196', 'APPROVED', 2.5, 0.0, 0.0, 2.5, 'REMOTE', NULL, 'Conducted code review session', 'E00196', '2025-11-25 18:00:00', NULL, NULL, NULL, NULL, NULL, 'E00196', '2025-11-25 14:00:00', NULL, NULL),
(NULL, NULL, v_activity3_id, '2025-11-28', 'E00196', 'APPROVED', 1.5, 0.0, 0.0, 1.5, 'REMOTE', NULL, 'Client meeting for requirements discussion', 'E00196', '2025-11-28 18:00:00', NULL, NULL, NULL, NULL, NULL, 'E00196', '2025-11-28 15:00:00', NULL, NULL);

-- =============================================================================
-- 10. TIMESHEET APPROVAL HISTORY
-- Note: This section would need to capture timesheet entry IDs dynamically
-- For now, using a simplified approach - in production, capture each entry_id after insertion
-- =============================================================================
-- Skipping detailed approval history for brevity - can be added by capturing entry IDs

-- =============================================================================
-- 11. COMMENTS (Comments on tasks, epics, timesheet entries, activities)
-- =============================================================================
INSERT INTO sts_ts.comments (
    parent_type, parent_code, comment_text, commented_by, commented_at,
    updated_by, updated_at
) VALUES 
-- Comments on Tasks
('TASK', v_task1_id, 'Great design work! The mockups look professional.', 'E00196', '2025-11-05 10:00:00', NULL, NULL),
('TASK', v_task1_id, 'Thanks! Will proceed with development.', 'SK001', '2025-11-05 11:00:00', NULL, NULL),
('TASK', v_task2_id, 'Profile section is working well. Please add email validation.', 'E00196', '2025-11-08 10:00:00', NULL, NULL),
('TASK', v_task2_id, 'Email validation added. Ready for review.', 'SK001', '2025-11-09 14:00:00', NULL, NULL),
('TASK', v_task4_id, 'API credentials configured successfully. Ready for integration.', 'E00196', '2025-11-13 18:00:00', NULL, NULL),
('TASK', v_task5_id, 'Payment processing logic implemented. Testing in progress.', 'E00196', '2025-11-19 17:00:00', NULL, NULL),
('TASK', v_task7_id, 'Query optimization completed. Performance improved by 40%.', 'SK001', '2025-11-10 17:30:00', NULL, NULL),
('TASK', v_task8_id, 'Bundle size reduced from 2.5MB to 1.2MB. Great work!', 'E00196', '2025-11-20 16:45:00', NULL, NULL),

-- Comments on Epics
('EPIC', v_epic1_id, 'Epic is progressing well. Keep up the good work!', 'E00196', '2025-11-10 11:00:00', NULL, NULL),
('EPIC', v_epic2_id, 'Payment integration is critical. Please prioritize this.', 'E00196', '2025-11-15 09:00:00', NULL, NULL),
('EPIC', v_epic3_id, 'Performance optimization completed successfully. Well done!', 'E00196', '2025-11-25 17:30:00', NULL, NULL),
('EPIC', v_epic4_id, 'Security audit is important. Please complete ASAP.', 'E00196', '2025-11-28 10:00:00', NULL, NULL);

-- =============================================================================
-- 12. ATTACHMENTS (Files attached to tasks, epics, timesheet entries, activities, leave applications)
-- =============================================================================
INSERT INTO sts_ts.attachments (
    parent_type, parent_code, file_path, file_url, file_name, file_type, file_size,
    purpose, created_by, created_at, updated_by, updated_at
) VALUES 
-- Attachments for Tasks
('TASK', v_task1_id, '/var/www/fileServer/task1_design_mockup.pdf', 'http://150.241.244.143/files/task1_design_mockup.pdf', 'Dashboard Design Mockup.pdf', 'pdf', '2.5 MB', 'TASK ATTACHMENT', 'SK001', '2025-11-05 15:00:00', NULL, NULL),
('TASK', v_task1_id, '/var/www/fileServer/task1_wireframes.png', 'http://150.241.244.143/files/task1_wireframes.png', 'Wireframes.png', 'png', '1.2 MB', 'TASK ATTACHMENT', 'SK001', '2025-11-05 16:00:00', NULL, NULL),
('TASK', v_task2_id, '/var/www/fileServer/task2_profile_code.zip', 'http://150.241.244.143/files/task2_profile_code.zip', 'Profile Section Code.zip', 'zip', '5.8 MB', 'TASK ATTACHMENT', 'SK001', '2025-11-08 17:00:00', NULL, NULL),
('TASK', v_task5_id, '/var/www/fileServer/task5_payment_logic.js', 'http://150.241.244.143/files/task5_payment_logic.js', 'Payment Processing Logic.js', 'js', '45.2 KB', 'TASK ATTACHMENT', 'E00196', '2025-11-19 16:00:00', NULL, NULL),

-- Attachments for Epics
('EPIC', v_epic1_id, '/var/www/fileServer/epic1_requirements.docx', 'http://150.241.244.143/files/epic1_requirements.docx', 'Customer Portal Requirements.docx', 'docx', '3.2 MB', 'EPIC ATTACHMENT', 'E00196', '2025-11-01 10:00:00', NULL, NULL),
('EPIC', v_epic2_id, '/var/www/fileServer/epic2_payment_api_docs.pdf', 'http://150.241.244.143/files/epic2_payment_api_docs.pdf', 'Payment Gateway API Documentation.pdf', 'pdf', '1.8 MB', 'EPIC ATTACHMENT', 'E00196', '2025-11-10 11:00:00', NULL, NULL),
('EPIC', v_epic4_id, '/var/www/fileServer/epic4_security_report.pdf', 'http://150.241.244.143/files/epic4_security_report.pdf', 'Security Audit Report.pdf', 'pdf', '4.5 MB', 'EPIC ATTACHMENT', 'E00196', '2025-11-28 10:00:00', NULL, NULL),

-- Attachments for Activities
('ACTIVITY', v_activity1_id, '/var/www/fileServer/act1_review_notes.docx', 'http://150.241.244.143/files/act1_review_notes.docx', 'Code Review Notes.docx', 'docx', '250 KB', 'ACTIVITY ATTACHMENT', 'E00196', '2025-11-25 18:00:00', NULL, NULL),
('ACTIVITY', v_activity2_id, '/var/www/fileServer/act2_training_slides.pptx', 'http://150.241.244.143/files/act2_training_slides.pptx', 'Framework Training Slides.pptx', 'pptx', '8.5 MB', 'ACTIVITY ATTACHMENT', 'E00196', '2025-11-20 18:00:00', NULL, NULL),
('ACTIVITY', v_activity3_id, '/var/www/fileServer/act3_meeting_minutes.pdf', 'http://150.241.244.143/files/act3_meeting_minutes.pdf', 'Client Meeting Minutes.pdf', 'pdf', '1.2 MB', 'ACTIVITY ATTACHMENT', 'E00196', '2025-11-28 18:00:00', NULL, NULL),

-- Attachments for Leave Applications
('LEAVE_APPLICATION', v_leave1_id, '/var/www/fileServer/leave1_medical_cert.pdf', 'http://150.241.244.143/files/leave1_medical_cert.pdf', 'Medical Certificate.pdf', 'pdf', '450 KB', 'LEAVE ATTACHMENT', 'SK001', '2025-11-13 10:00:00', NULL, NULL),
('LEAVE_APPLICATION', v_leave3_id, '/var/www/fileServer/leave3_doctor_note.pdf', 'http://150.241.244.143/files/leave3_doctor_note.pdf', 'Doctor Note.pdf', 'pdf', '320 KB', 'LEAVE ATTACHMENT', 'SK001', '2025-11-24 09:00:00', NULL, NULL);

END $$;

-- =============================================================================
-- SUMMARY
-- =============================================================================
-- Predefined Epics: 3
-- Predefined Tasks: 3
-- Activities: 3
-- Epics: 4
-- Epic History: 8 records
-- Tasks: 10
-- Task History: 20 records
-- Leave Applications for SK001: 7 total
--   - APPROVED: 1 (26/11 - kept for testing)
--   - SUBMITTED (Pending): 5 (15-16/11, 20/11, 25-26/11, 28/11, 29/11)
--   - DRAFT: 1 (5-7/12 - future, not counted as pending, hidden from admin)
-- Timesheet Entries for SK001: 10 total
--   - APPROVED: 7 (03/11, 04/11, 05/11, 06/11, 07/11, 08/11, 25/11)
--   - SUBMITTED (Pending): 3 (28/11, 29/11, 30/11)
--   - Total Hours Last 7 Days (24/11-30/11): 16.5h
-- Tasks for SK001: 4 tasks (1 overdue, 2 in progress, 2 to do, 0 completed)
-- Expected Dashboard Counts:
--   - Timesheet Approved: 7 (all time)
--   - Timesheet Pending: 3 (all time)
--   - Leave Approved: 1 (all time)
--   - Leave Pending: 5 (all time - only SUBMITTED, not DRAFT)
-- Comments: 12
-- Attachments: 12
-- =============================================================================
