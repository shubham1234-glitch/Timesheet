export type Role = "employee" | "admin" | "superadmin" | "hr";

export type NavItem = { label: string; href: string };

export const navByRole: Record<Role, NavItem[]> = {
  employee: [
    { label: "Dashboard", href: "/employee/dashboard" },
    { label: "Timesheet", href: "/employee/timesheet" },
    { label: "Activities", href: "/employee/outdoor-things" },
    { label: "Epics", href: "/employee/epics" },
    { label: "Tasks", href: "/employee/tasks" },
    { label: "Available Tasks", href: "/employee/available-tasks" },
  ],
  admin: [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Timesheet", href: "/admin/timesheet" },
    { label: "Team Timesheet", href: "/admin/team-timesheet" },
    { label: "Activities", href: "/admin/outdoor-things" },
    { label: "Epics", href: "/admin/epics" },
    { label: "Tasks", href: "/admin/tasks" },
    { label: "Available Tasks", href: "/admin/available-tasks" },
  ],
  superadmin: [
    { label: "Dashboard", href: "/super-admin/dashboard" },
    { label: "Team Timesheet", href: "/super-admin/team-member-timesheet" },
    { label: "Activities", href: "/super-admin/outdoor-things" },
    { label: "Epics", href: "/super-admin/epics" },
    { label: "Available Tasks", href: "/super-admin/available-tasks" },
  ],
  hr: [
    { label: "Dashboard", href: "/hr/dashboard" },
    { label: "Timesheet", href: "/hr/timesheet" },
    { label: "Team Timesheet", href: "/hr/team-timesheet" },
    { label: "Activities", href: "/hr/outdoor-things" },
    { label: "Available Tasks", href: "/hr/available-tasks" },
    // { label: "Leave Registry", href: "/hr/leave-registry" },
    // Epics removed for HR per requirement
  ],
};


