"use client";

import { Button, Table, Tag, Select, Input, InputNumber, DatePicker, Upload, AutoComplete } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { CheckOutlined, CalendarOutlined, PlusOutlined } from "@ant-design/icons";
import { useState, useMemo, useEffect } from "react";
import dayjs from "dayjs";
import { usePathname, useRouter } from "next/navigation";
import { apiRequest, getMasterDataFromCache, clearMasterDataCache, fetchAndCacheMasterData } from "@/app/lib/api";
import { toast } from "react-hot-toast";
import SimpleGanttChart from "./SimpleGanttChart";
import { getProductOptions, getPriorityOptions, getClientOptions, getContactPersonOptions, getAllEmployeeOptions, getStatusOptions, onMasterDataChange, getPredefinedEpicOptions, getPredefinedEpicById, getTaskTypeOptions, getWorkLocationOptions } from "@/app/lib/masterData";
import { getRoleBase, buildRoleHref } from "@/app/lib/paths";
import { getStatusTextColor, getPriorityTextColor, statusTagColor, getStatusDisplayLabel } from "@/app/lib/uiMaps";

interface UseExistingEpicContentProps {
  onCreated?: () => void;
  onCancel?: () => void;
  /**
   * Optional: existing epic ID whose tasks are being edited.
   * Required for calling the backend delete API /delete_task/{epic_id}/{task_id}.
   * When not provided, delete will only affect local state (template not yet persisted).
   */
  epicIdForDelete?: number | string;
}

interface PredefinedTask {
  id: string;
  title: string;
  description: string;
  estimatedHours: number;
  startDate: string;
  dueDate: string;
  priority: string;
  type: string;
  workMode?: string; // Work mode from master data
  team?: string;
  assignee?: string;
  status?: string;
  isBillable?: boolean;
  selected: boolean;
  taskId?: number; // Store actual task ID after creation
  // Optional dependency: if set, this task starts after the dependency task's due date
  dependsOnTaskId?: string;
  // Master data fields
  predefinedTaskId?: number; // ID from predefined_task table
  defaultTaskTypeCode?: string;
  defaultWorkMode?: string;
  defaultWorkModeName?: string;
  defaultStatusCode?: string;
  defaultPriorityCode?: number;
}

interface PredefinedEpic {
  id: string;
  name: string;
  description: string;
  epicTitle?: string;
  epicDescription?: string;
  startDate: string;
  dueDate: string;
  priority?: string;
  product?: string;
  client?: string;
  contactPerson?: string;
  estimatedHours?: number;
  isBillable?: boolean;
  tasks: PredefinedTask[];
}

const labelCls = "block text-xs font-semibold text-gray-700 mb-1.5";
const required = <span className="text-red-500 ml-1">*</span>;

// Helper function to add working days (Monday-Friday), skipping weekends
const addWorkingDays = (startDate: dayjs.Dayjs, workingDays: number): dayjs.Dayjs => {
  let currentDate = startDate.clone();
  let daysAdded = 0;
  const daysToAdd = Math.ceil(workingDays);
  
  // Start date is day 1, so we need to add (workingDays - 1) more days
  while (daysAdded < daysToAdd - 1) {
    currentDate = currentDate.add(1, 'day');
    const dayOfWeek = currentDate.day(); // 0 = Sunday, 6 = Saturday
    // Only count Monday-Friday (1-5) as working days
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }
  
  // If the final date falls on a weekend, move to next Monday
  const finalDayOfWeek = currentDate.day();
  if (finalDayOfWeek === 0) { // Sunday
    currentDate = currentDate.add(1, 'day'); // Move to Monday
  } else if (finalDayOfWeek === 6) { // Saturday
    currentDate = currentDate.add(2, 'day'); // Move to Monday
  }
  
  return currentDate;
};

// Helper: get the next working day (Mon–Fri) after a given date
const getNextWorkingDay = (date: dayjs.Dayjs): dayjs.Dayjs => {
  let currentDate = date.add(1, "day");
  const dayOfWeek = currentDate.day();
  if (dayOfWeek === 0) {
    // Sunday -> Monday
    currentDate = currentDate.add(1, "day");
  } else if (dayOfWeek === 6) {
    // Saturday -> Monday
    currentDate = currentDate.add(2, "day");
  }
  return currentDate;
};

// Helper: count working days (Mon–Fri) between two dates inclusive
const countWorkingDaysInclusive = (start: dayjs.Dayjs, end: dayjs.Dayjs): number => {
  if (!start.isValid() || !end.isValid()) return 1;
  if (end.isBefore(start, "day")) return 1;
  let workingDays = 0;
  let current = start.clone();
  while (current.isBefore(end, "day") || current.isSame(end, "day")) {
    const dow = current.day();
    if (dow !== 0 && dow !== 6) {
      workingDays += 1;
    }
    current = current.add(1, "day");
  }
  return Math.max(1, workingDays);
};

export default function UseExistingEpicContent({ onCreated, onCancel, epicIdForDelete }: UseExistingEpicContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const roleBase = getRoleBase(pathname || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<PredefinedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [predefinedEpics, setPredefinedEpics] = useState<PredefinedEpic[]>([]);
  const [loadingEpics, setLoadingEpics] = useState(false);

  // Epic form fields
  const [epicTitle, setEpicTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(null);
  const [dueDate, setDueDate] = useState<dayjs.Dayjs | null>(null);
  const [product, setProduct] = useState<string>("");
  const [client, setClient] = useState<string>("");
  const [contactPerson, setContactPerson] = useState<string>("");
  const [estimatedHours, setEstimatedHours] = useState<number | null>(null);
  const [isBillable, setIsBillable] = useState<boolean>(false);
  
  // Calculate estimated days from estimated hours (8 hours = 1 working day)
  const estimatedDays = useMemo(() => {
    if (estimatedHours == null || estimatedHours <= 0) return null;
    return Math.ceil(estimatedHours / 8 * 100) / 100; // Round to 2 decimal places
  }, [estimatedHours]);
  
  // Auto-calculate due date from start date and estimated days (working days only)
  useEffect(() => {
    if (startDate && estimatedDays != null && estimatedDays > 0) {
      const calculatedDueDate = addWorkingDays(startDate, estimatedDays);
      setDueDate(calculatedDueDate);
    }
  }, [startDate, estimatedDays]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadList, setUploadList] = useState<UploadFile[]>([]);
  const [reporterName, setReporterName] = useState<string>("");
  const [taskTitleOptions, setTaskTitleOptions] = useState<Array<{ value: string }>>([]);
  const [predefinedTitleToTeam, setPredefinedTitleToTeam] = useState<Record<string, string>>({});
  const [previousEpicDueDate, setPreviousEpicDueDate] = useState<string | null>(null);
  const [manuallyEditedTaskDueDates, setManuallyEditedTaskDueDates] = useState<Set<string>>(new Set());
  const [selectedTaskIds, setSelectedTaskIds] = useState<React.Key[]>([]);

  // Validation errors state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const selectedEpic = useMemo(() => {
    return predefinedEpics.find(epic => epic.id === selectedTemplateId) || null;
  }, [selectedTemplateId, predefinedEpics]);

  // Recompute task dates based on dependencies and epic start date
  const recomputeTaskDates = (inputTasks: PredefinedTask[]): PredefinedTask[] => {
    if (!startDate && !inputTasks.some(t => t.dependsOnTaskId)) {
      return inputTasks;
    }

    const byId = new Map<string, PredefinedTask>();
    inputTasks.forEach((t) => byId.set(t.id, t));

    return inputTasks.map((task) => {
      let baseStart: dayjs.Dayjs | null = null;

      if (task.dependsOnTaskId) {
        const dep = byId.get(task.dependsOnTaskId);
        if (dep?.dueDate) {
          const depDue = dayjs(dep.dueDate, "YYYY-MM-DD");
          if (depDue.isValid()) {
            baseStart = getNextWorkingDay(depDue);
          }
        }
      }

      if (!baseStart && startDate) {
        baseStart = startDate;
      }

      if (!baseStart) {
        return task;
      }

      const startStr = baseStart.format("YYYY-MM-DD");
      let due = task.dueDate ? dayjs(task.dueDate, "YYYY-MM-DD") : null;
      if (!due || !due.isValid() || due.isBefore(baseStart, "day")) {
        due = baseStart.add(7, "day");
      }

      return {
        ...task,
        startDate: startStr,
        dueDate: due.format("YYYY-MM-DD"),
      };
    });
  };

  // Recompute task dates when epic start date changes
  useEffect(() => {
    setTasks((prev) => recomputeTaskDates(prev));
  }, [startDate]);

  // Master data options
  const [productOptions, setProductOptions] = useState(getProductOptions());
  const [priorityOptions, setPriorityOptions] = useState(getPriorityOptions());
  const [clientOptions, setClientOptions] = useState(getClientOptions());
  const [contactPersonOptions, setContactPersonOptions] = useState(getContactPersonOptions());
  const [teamOptions, setTeamOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [employeeOptions, setEmployeeOptions] = useState(getAllEmployeeOptions());
  const [statusOptions, setStatusOptions] = useState(getStatusOptions());

  // Get team options from team_master (preferred) or fallback to employees
  const getTeamOptionsFromEmployees = (): Array<{ value: string; label: string }> => {
    try {
      const md = getMasterDataFromCache<any>();
      
      // First try to get teams from team_master (preferred)
      const teamsFromMaster = md?.data?.teams || [];
      if (teamsFromMaster && teamsFromMaster.length > 0) {
        const teamList = teamsFromMaster
          .filter((team: any) => team?.is_active !== false)
          .map((team: any) => ({
            value: team.team_name || team.team_code || '',
            label: team.team_name || team.team_code || '',
          }))
          .filter((opt: any) => opt.value && opt.label)
          .sort((a: any, b: any) => a.label.localeCompare(b.label));
        
        if (teamList.length > 0) {
          return teamList;
        }
      }
      
      // Fallback: Get teams from employees if team_master is not available
      const employees = md?.data?.employees || [];
      const teams = new Set<string>();
      employees.forEach((emp: any) => {
        if (emp?.team_name) {
          teams.add(emp.team_name);
        }
      });
      const teamList = Array.from(teams).map(team => ({ value: team, label: team })).sort((a, b) => a.label.localeCompare(b.label));
      return teamList.length > 0 ? teamList : [
        { value: "Support team", label: "Support team" },
        { value: "DEV team", label: "DEV team" },
        { value: "DA team", label: "DA team" },
        { value: "QA team", label: "QA team" },
        { value: "Design team", label: "Design team" },
      ];
    } catch {
      // Fallback to common teams if master data is not available
      return [
        { value: "Support team", label: "Support team" },
        { value: "DEV team", label: "DEV team" },
        { value: "DA team", label: "DA team" },
        { value: "QA team", label: "QA team" },
        { value: "Design team", label: "Design team" },
      ];
    }
  };

  // Get employees filtered by team name
  const getEmployeesByTeam = (teamName: string | undefined): Array<{ value: string; label: string }> => {
    if (!teamName || !teamName.trim()) {
      // If no team selected, return all employees
      return employeeOptions;
    }

    try {
      const md = getMasterDataFromCache<any>();
      const employees = md?.data?.employees || [];

      // Filter employees by team name (case-insensitive)
      const teamEmployees = employees
        .filter((emp: any) => {
          const empTeamName = emp?.team_name || '';
          return empTeamName.toLowerCase().trim() === teamName.toLowerCase().trim();
        })
        .map((emp: any) => ({
          value: emp.user_code || emp.userCode || '',
          label: emp.user_name || emp.userName || emp.user_code || emp.userCode || '',
        }))
        .filter((opt: any) => opt.value && opt.label) // Remove empty entries
        .sort((a: any, b: any) => a.label.localeCompare(b.label));

      return teamEmployees.length > 0 ? teamEmployees : employeeOptions; // Fallback to all if no matches
    } catch {
      // If error, return all employees as fallback
      return employeeOptions;
    }
  };

  // Update options when master data changes
  useEffect(() => {
    const update = () => {
      setProductOptions(getProductOptions());
      setPriorityOptions(getPriorityOptions());
      const clientOpts = getClientOptions();
      console.log('Client options loaded:', clientOpts.length, clientOpts);
      setClientOptions(clientOpts);
      const newContactOptions = getContactPersonOptions(client || undefined);
      setContactPersonOptions(newContactOptions);

      // Update team options
      const teams = getTeamOptionsFromEmployees();
      setTeamOptions(teams);

      // Update employee options
      setEmployeeOptions(getAllEmployeeOptions());

      // Update status options
      setStatusOptions(getStatusOptions());

      if (client) {
        setContactPerson((prev) => {
          const isValid = newContactOptions.some(cp => cp.value === prev);
          return isValid ? prev : "";
        });
      } else {
        setContactPerson("");
      }
    };
    const unsub = onMasterDataChange(update);
    update();
    return unsub;
  }, [client]);

  // Load predefined epics from master data
  useEffect(() => {
    const loadPredefinedEpics = () => {
      const d = getMasterDataFromCache<any>();
      const masterEpics = d?.data?.predefined_epics || [];
      const masterTasks = d?.data?.predefined_tasks || [];

      // Transform master data to match component's expected format
      const transformedEpics: PredefinedEpic[] = masterEpics
        .filter((epic: any) => epic?.is_active !== false)
        .map((epic: any) => {
          // Use only the tasks linked to this epic (from epic.tasks array)
          // The API now returns only linked tasks via the predefined_epic_tasks junction table
          const epicTasks = epic?.tasks || [];
          const transformedTasks = epicTasks.map((task: any): PredefinedTask => {
            // Prefer explicit predefined_task_id from API when available
            const rawPredefinedTaskId =
              task.predefined_task_id ??
              task.predefinedTaskId ??
              task.id ??
              task.task_id;
            // Get work mode name from master data
            // API returns work_mode (not default_work_mode)
            const workModeOptions = getWorkLocationOptions();
            const workModeCode = task.work_mode || '';
            const workModeOption = workModeOptions.find(opt => opt.value === workModeCode);
            const workModeName = workModeOption?.label || workModeCode || '';

            // Get task type name from API response or master data
            let taskTypeName = '';
            if (task.task_type_name) {
              // Use task_type_name from API if available
              taskTypeName = task.task_type_name;
            } else if (task.task_type_code) {
              // If only task_type_code is available, look it up in master data
              try {
                const taskTypeOptions = getTaskTypeOptions();
                const taskTypeOption = taskTypeOptions.find(opt => opt.value === task.task_type_code);
                taskTypeName = taskTypeOption?.label || '';
              } catch (error) {
                taskTypeName = '';
              }
            }

            return {
              // Use a stable string ID based on the underlying predefined task ID
              id: rawPredefinedTaskId ? String(rawPredefinedTaskId) : String(task.id || ''),
              title: task.task_title || '',
              description: task.task_description || '',
              estimatedHours: Number(task.estimated_hours || 0),
              startDate: '', // Predefined tasks don't have start_date
              dueDate: '', // Predefined tasks don't have due_date
              priority: task.priority_code ? String(task.priority_code) : '2', // API returns priority_code
              type: taskTypeName, // Use display name instead of code
              workMode: workModeName, // Use display name instead of code
              status: task.status_code || '', // API returns status_code
              isBillable: task.is_billable ?? true,
              selected: true,
              // Store master data fields for reference
              predefinedTaskId: rawPredefinedTaskId ? Number(rawPredefinedTaskId) : Number(task.id || 0),
              defaultTaskTypeCode: task.task_type_code || '', // Use task_type_code from API
              defaultWorkMode: workModeCode, // Use work_mode from API
              defaultWorkModeName: workModeName,
              defaultStatusCode: task.status_code || '', // Use status_code from API
              defaultPriorityCode: task.priority_code || 0, // Use priority_code from API
              team: task.team_name || '',
            };
          });

          return {
            id: String(epic.id),
            name: epic.predefined_epic_name || epic.title || "",
            description: epic.description || epic.epic_description || "",
            epicTitle: epic.epic_title || epic.title || "",
            epicDescription: epic.description || "",
            priority: (epic.default_priority_code ?? epic.priority_code) ? String(epic.default_priority_code ?? epic.priority_code) : "",
            product: epic.default_product_code || epic.product_code || "",
            client: epic.default_company_code || epic.company_code || "",
            contactPerson: epic.default_contact_person_code || epic.contact_person_code || "",
            estimatedHours: Number(epic.estimated_hours ?? 0),
            isBillable: (typeof epic.default_is_billable !== "undefined" ? epic.default_is_billable : epic.is_billable) ?? true,
            tasks: transformedTasks,
          };
        });

      // Build title options and title→team mapping from predefined_tasks
      try {
        const titleTeamPairs: Array<{ title: string; teamName: string }> = masterTasks
          .map((t: any) => ({
            title: String(t.task_title || "").trim(),
            teamName: String(t.team_name || "").trim(),
          }))
          .filter((pair: { title: string; teamName: string }) => pair.title.length > 0);

        const uniqueTitles = Array.from(
          new Set<string>(titleTeamPairs.map((pair: { title: string }) => pair.title))
        );
        setTaskTitleOptions(uniqueTitles.map((title: string) => ({ value: title })));

        const titleToTeam: Record<string, string> = {};
        titleTeamPairs.forEach(({ title, teamName }: { title: string; teamName: string }) => {
          if (title && teamName && !titleToTeam[title]) {
            titleToTeam[title] = teamName;
          }
        });
        
        console.log('[DEBUG] Built title-to-team mapping:', {
          totalTasks: masterTasks.length,
          titleTeamPairs: titleTeamPairs.length,
          pairsWithTeam: titleTeamPairs.filter(p => p.teamName).length,
          mappingSize: Object.keys(titleToTeam).length,
          sampleMapping: Object.keys(titleToTeam).slice(0, 5).reduce((acc, key) => {
            acc[key] = titleToTeam[key];
            return acc;
          }, {} as Record<string, string>)
        });
        
        setPredefinedTitleToTeam(titleToTeam);
      } catch (error) {
        console.error('[ERROR] Error building title-to-team mapping:', error);
      }

      setPredefinedEpics(transformedEpics);
      setLoadingEpics(false);
    };

    // Load initially
    loadPredefinedEpics();

    // Subscribe to master data changes
    const unsubscribe = onMasterDataChange(loadPredefinedEpics);
    return unsubscribe;
  }, []);

  // Load reporter name
  useEffect(() => {
    const loadReporterName = async () => {
      try {
        const { getUserFromStorage } = await import("../../../../lib/auth/storage");
        const user = getUserFromStorage();
        if (user?.userName) setReporterName(user.userName);
      } catch { }
    };
    loadReporterName();
  }, []);

  // Update form fields when template is selected
  // Only run when selectedEpic changes, not when options change (to avoid resetting user selections)
  useEffect(() => {
    if (selectedEpic) {
      // Use epicTitle and epicDescription from API if available, otherwise fallback to name/description
      setEpicTitle(selectedEpic.epicTitle || selectedEpic.name);
      setDescription(selectedEpic.epicDescription || selectedEpic.description);

      // Validate and set priority - only set if it exists in options
      const templatePriority = selectedEpic.priority || "";
      const isValidPriority = priorityOptions.some(opt => opt.value === templatePriority);
      if (isValidPriority) {
        setPriority(templatePriority);
      }

      // Don't set dates from template - user should set them
      // setStartDate(dayjs(selectedEpic.startDate));
      // setDueDate(dayjs(selectedEpic.dueDate));

      // Validate and set product - only set if it exists in options
      const templateProduct = selectedEpic.product || "";
      const isValidProduct = productOptions.some(opt => opt.value === templateProduct);
      if (isValidProduct) {
        setProduct(templateProduct);
      }

      // Set client first, then contact person (contact person options depend on client)
      const templateClient = selectedEpic.client || "";
      const templateContactPerson = selectedEpic.contactPerson || "";

      // Validate client - only set if it exists in options
      const isValidClient = clientOptions.some(opt => opt.value === templateClient);
      if (isValidClient) {
        setClient(templateClient);

        // Update contact person options based on the client, then set contact person
        // Use setTimeout to ensure options are updated first
        setTimeout(() => {
          const updatedContactOptions = getContactPersonOptions(templateClient || undefined);
          setContactPersonOptions(updatedContactOptions);

          // Set contact person only if it's valid in the updated options
          if (templateContactPerson) {
            const isValidContact = updatedContactOptions.some(cp => cp.value === templateContactPerson);
            if (isValidContact) {
              setContactPerson(templateContactPerson);
            }
          }
        }, 0);
      }

      setEstimatedHours(selectedEpic.estimatedHours || null);
      setIsBillable(selectedEpic.isBillable || false);

      // Set tasks - use epic dates if they're already set, otherwise use task's own dates or empty
      const epicStartDateStr = startDate ? startDate.format("YYYY-MM-DD") : null;
      const epicDueDateStr = dueDate ? dueDate.format("YYYY-MM-DD") : null;
      const mappedTasks: PredefinedTask[] = selectedEpic.tasks.map((t, index) => ({
        ...t,
        selected: true,
        assignee: "", // Always start with empty assignee - user must explicitly select
        status: "To Do",
        // Default dependency: linear chain based on order
        dependsOnTaskId: index > 0 ? selectedEpic.tasks[index - 1].id : undefined,
        // Use epic due date if set, otherwise use task's own due date from template, or empty
        dueDate: epicDueDateStr || (t.dueDate && t.dueDate.trim() ? t.dueDate : ""),
        // Use epic start date if set, otherwise use task's own start date from template, or empty
        startDate: epicStartDateStr || (t.startDate && t.startDate.trim() ? t.startDate : ""),
      }));
      setTasks(recomputeTaskDates(mappedTasks));
      // Reset manually edited flags when new template is selected
      setManuallyEditedTaskDueDates(new Set());
      // Recalculate hours after tasks are set
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEpic?.id]); // Only run when the selected epic ID changes, not when options change

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
  };

  const handleTaskFieldChange = (taskId: string, field: keyof PredefinedTask, value: any) => {
    setTasks(prev => {
      let updatedTasks = prev.map(t =>
        t.id === taskId ? { ...t, [field]: value } : t
      );

      // Recompute all task dates based on dependencies and epic start
      updatedTasks = recomputeTaskDates(updatedTasks);

      return updatedTasks;
    });

    // Removed estimated hours recalculation - tasks no longer have estimated hours in UI
  };

  const handleAddTask = () => {
    // No default dependency - user can set it manually if needed
    const dependsOnTaskId = undefined;

    // Calculate start date: use epic start date (or today as fallback)
    const newStartDate = startDate || dayjs();

    // Default due date: 7 days from start date
    const newDueDate = newStartDate.add(7, "day");

    const newTask: PredefinedTask = {
      id: `task-${Date.now()}`,
      title: "",
      description: "",
      estimatedHours: 0,
      startDate: newStartDate.format("YYYY-MM-DD"),
      dueDate: newDueDate.format("YYYY-MM-DD"),
      priority: "2", // Default to Medium
      type: "",
      team: "",
      assignee: "",
      status: "To Do",
      isBillable: false,
      selected: true,
      dependsOnTaskId,
    };
    setTasks(prev => recomputeTaskDates([...prev, newTask]));
  };

  const handleTaskTitleChange = (taskId: string, value: string) => {
    handleTaskFieldChange(taskId, "title", value);
    const trimmed = value.trim();
    
    if (trimmed) {
      let teamName: string | undefined;
      
      // First try exact match in state mapping
      teamName = predefinedTitleToTeam[trimmed];
      
      // If not found, try case-insensitive match in state mapping
      if (!teamName) {
        const matchingKey = Object.keys(predefinedTitleToTeam).find(
          key => key.trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (matchingKey) {
          teamName = predefinedTitleToTeam[matchingKey];
        }
      }
      
      // If still not found, look up directly from master data
      if (!teamName) {
        try {
          const md = getMasterDataFromCache<any>();
          const masterTasks = md?.data?.predefined_tasks || [];
          
          // Try exact match first
          const exactMatch = masterTasks.find((t: any) => 
            String(t.task_title || "").trim() === trimmed
          );
          
          if (exactMatch?.team_name) {
            teamName = String(exactMatch.team_name).trim();
          } else {
            // Try case-insensitive match
            const caseInsensitiveMatch = masterTasks.find((t: any) => 
              String(t.task_title || "").trim().toLowerCase() === trimmed.toLowerCase()
            );
            
            if (caseInsensitiveMatch?.team_name) {
              teamName = String(caseInsensitiveMatch.team_name).trim();
            }
          }
        } catch (error) {
          console.error('[ERROR] Error looking up team from master data:', error);
        }
      }
      
      // Set team if found
      if (teamName) {
        console.log('[DEBUG] Auto-assigning team:', { taskId, title: trimmed, teamName });
        handleTaskFieldChange(taskId, "team", teamName);
      } else {
        console.log('[DEBUG] No team found for title:', trimmed, {
          mappingKeys: Object.keys(predefinedTitleToTeam),
          mappingSize: Object.keys(predefinedTitleToTeam).length
        });
      }
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    await handleDeleteTasks([taskId]);
  };

  const handleDeleteTasks = async (taskIds: React.Key[]) => {
    if (taskIds.length === 0) {
      toast.error('Please select at least one task to delete');
      return;
    }

    // Find the tasks to delete
    const tasksToDelete = tasks.filter(t => taskIds.includes(t.id));
    const taskTitles = tasksToDelete.map(t => t.title).join(', ');
    const taskCount = tasksToDelete.length;

    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete ${taskCount} task(s)?\n\nTasks: ${taskTitles}\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      console.log('Delete cancelled by user');
      return;
    }

    // Separate tasks into those with database IDs and those without
    const tasksWithDbId = tasksToDelete.filter(t => t.taskId);
    const tasksWithoutDbId = tasksToDelete.filter(t => !t.taskId);

    // Delete tasks with database IDs via API
    if (tasksWithDbId.length > 0) {
      if (!epicIdForDelete) {
        console.warn("⚠️ Cannot call delete task API: epicIdForDelete prop is not provided. Falling back to local delete only.");
        // Fall back to local-only delete for all tasks
        setTasks(prev => prev.filter(t => !taskIds.includes(t.id)));
        toast.success(`${taskCount} task(s) removed from template`);
        setSelectedTaskIds([]);
        return;
      }

      try {
        setLoading(true);
        // Delete tasks one by one (or in batch if API supports it)
        const deletePromises = tasksWithDbId.map(async (task) => {
          const endpoint = `delete_task/${epicIdForDelete}/${task.taskId}`;
          console.log('Calling delete API:', { endpoint, method: 'DELETE', databaseTaskId: task.taskId });
          return apiRequest(endpoint, 'DELETE');
        });

        const responses = await Promise.all(deletePromises);
        const successCount = responses.filter((r: any) => r?.success_flag === true || r?.success === true).length;
        const failedCount = responses.length - successCount;

        // Remove all deleted tasks from local state
        setTasks(prev => prev.filter(t => !taskIds.includes(t.id)));
        setSelectedTaskIds([]);

        if (failedCount === 0) {
          toast.success(`${successCount} task(s) deleted successfully`);
        } else {
          toast(`${successCount} task(s) deleted, ${failedCount} failed`, { icon: '⚠️' });
        }

        // Recalculate hours after deletion
      } catch (error) {
        console.error('Error deleting tasks:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete tasks';
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    } else {
      // All tasks are not yet created in DB, just remove from local state
      console.log('All tasks have no database taskId, removing from local state only.');
      setTasks(prev => prev.filter(t => !taskIds.includes(t.id)));
      setSelectedTaskIds([]);
      toast.success(`${taskCount} task(s) removed from template`);
      // Recalculate hours after deletion
    }
  };

  const handleDeleteSelectedTasks = async () => {
    if (selectedTaskIds.length === 0) {
      toast.error('Please select at least one task to delete');
      return;
    }
    await handleDeleteTasks(selectedTaskIds);
  };

  // Removed updateEstimatedHours - tasks no longer have estimated hours in UI

  // Removed useEffect for updateEstimatedHours - tasks no longer have estimated hours in UI


  const handleNumberKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    const allowed = ["Backspace", "Tab", "Delete", "ArrowLeft", "ArrowRight", "Home", "End"];
    const isNumber = /[0-9]/.test(e.key);
    const isDot = e.key === ".";
    if (allowed.includes(e.key)) return;
    if (isNumber) return;
    if (isDot) {
      const input = e.currentTarget as HTMLInputElement;
      if (input.value.includes(".")) {
        e.preventDefault();
      }
      return;
    }
    e.preventDefault();
  };

  // Simple custom toggle switch
  const ToggleSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`}
        />
      </button>
    );
  };

  // Validation functions (same as CreateEpicForm)
  const validateField = (field: string, value: any): string => {
    switch (field) {
      case 'selectedTemplateId':
        if (!value) return 'Template selection is required';
        return '';
      case 'epicTitle':
        if (!value || !value.trim()) return 'Epic title is required';
        if (value.trim().length < 3) return 'Epic title must be at least 3 characters';
        if (value.trim().length > 200) return 'Epic title must be less than 200 characters';
        return '';
      case 'description':
        if (!value || !value.trim()) return 'Description is required';
        if (value.trim().length < 10) return 'Description must be at least 10 characters';
        if (value.trim().length > 2000) return 'Description must be less than 2000 characters';
        return '';
      case 'priority':
        if (!value) return 'Priority is required';
        return '';
      case 'product':
        if (!value) return 'Product is required';
        return '';
      case 'client':
        if (!value) return 'Client is required';
        return '';
      case 'contactPerson':
        if (!value) return 'Contact person is required';
        return '';
      case 'startDate':
        if (!value) return 'Start date is required';
        if (value.startOf('day').isBefore(dayjs().startOf('day'))) {
          return 'Start date cannot be before today';
        }
        if (dueDate && value.startOf('day').isAfter(dueDate.startOf('day'))) {
          return 'Start date cannot be after due date';
        }
        return '';
      case 'dueDate':
        if (!value) return 'Due date is required';
        if (value.startOf('day').isBefore(dayjs().startOf('day'))) {
          return 'Due date cannot be before today';
        }
        if (startDate && value.startOf('day').isBefore(startDate.startOf('day'))) {
          return 'Due date cannot be before start date';
        }
        return '';
      case 'estimatedHours':
        if (value == null) return 'Estimated hours is required';
        if (value < 0) return 'Estimated hours cannot be negative';
        if (value > 10000) return 'Estimated hours must be less than 10000';
        return '';
      default:
        return '';
    }
  };

  const handleFieldChange = (field: string, value: any, setter: (val: any) => void) => {
    setter(value);
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
    // Also validate related fields
    if (field === 'startDate' && touched['dueDate']) {
      const error = validateField('dueDate', dueDate);
      setErrors(prev => ({ ...prev, dueDate: error }));
    }
    if (field === 'dueDate' && touched['startDate']) {
      const error = validateField('startDate', startDate);
      setErrors(prev => ({ ...prev, startDate: error }));
    }
    if (field === 'client') {
      setContactPerson("");
      setErrors(prev => ({ ...prev, contactPerson: '' }));
    }
  };

  const handleFieldBlur = (field: string, value: any) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const validateAllFields = (): boolean => {
    const newErrors: Record<string, string> = {};
    const fieldsToValidate = [
      { field: 'selectedTemplateId', value: selectedTemplateId },
      { field: 'epicTitle', value: epicTitle },
      { field: 'description', value: description },
      { field: 'priority', value: priority },
      { field: 'product', value: product },
      { field: 'client', value: client },
      { field: 'contactPerson', value: contactPerson },
      { field: 'startDate', value: startDate },
      { field: 'dueDate', value: dueDate },
      { field: 'estimatedHours', value: estimatedHours },
    ];

    fieldsToValidate.forEach(({ field, value }) => {
      const error = validateField(field, value);
      if (error) {
        newErrors[field] = error;
      }
    });

    setErrors(newErrors);
    setTouched({
      selectedTemplateId: true,
      epicTitle: true,
      description: true,
      priority: true,
      product: true,
      client: true,
      contactPerson: true,
      startDate: true,
      dueDate: true,
      estimatedHours: true,
    });

    return Object.keys(newErrors).length === 0;
  };

  const handleCreateEpic = async () => {
    if (!selectedEpic) {
      toast.error("Please select a template");
      return;
    }

    if (tasks.length === 0) {
      toast.error("No tasks available");
      return;
    }

    // Validate all fields
    if (!validateAllFields()) {
      toast.error('Please fix all validation errors before submitting');
      return;
    }

    setLoading(true);
    try {
      // Use the use_existing_epic endpoint which creates epic and tasks from template
      const form = new FormData();

      // Required fields for use_existing_epic endpoint
      form.append("predefined_epic_id", selectedEpic.id);

      // Get team codes from master data (needed for helper function)
      const md = getMasterDataFromCache<any>();
      const employees = md?.data?.employees || [];

      // Helper to get team_code from team name
      const getTeamCodeFromName = (teamName: string): string | null => {
        if (!teamName) return null;
        // Find first employee with this team name and get their team_code
        const emp = employees.find((e: any) =>
          e.team_name && e.team_name.toLowerCase() === teamName.toLowerCase()
        );
        return emp?.team_code || null;
      };

      // REQUIRED: predefined_task_ids as JSON array
      // Extract predefined task IDs from tasks (must be numeric IDs from predefined_task table)
      const predefinedTaskIds: number[] = [];
      const newTasks: Record<string, any> = {};

      // Find the highest predefined task ID so we can allocate new IDs sequentially after it
      let maxPredefinedTaskId = 0;
      for (const task of tasks) {
        if (task.predefinedTaskId && task.predefinedTaskId > maxPredefinedTaskId) {
          maxPredefinedTaskId = task.predefinedTaskId;
        }
      }
      // If there are no predefined tasks, start new IDs from 1; otherwise from max+1
      let newTaskCounter = maxPredefinedTaskId > 0 ? maxPredefinedTaskId + 1 : 1;

      // Separate predefined tasks and new tasks
      for (const task of tasks) {
        if (task.predefinedTaskId && task.predefinedTaskId > 0) {
          // Existing predefined task – use its actual ID
          predefinedTaskIds.push(Number(task.predefinedTaskId));
        } else {
          // New task - will be added to new_tasks object
          // Use a sequential numeric ID (e.g. 1,2,3 or max_predefined+1, ...)
          const tempTaskId = String(newTaskCounter++);

          // Get work mode code from work mode name
          let workModeCode = task.defaultWorkMode || '';
          if (task.workMode && !workModeCode) {
            // Try to find work mode code from master data
            const workModeOptions = getWorkLocationOptions();
            const workModeOption = workModeOptions.find(opt => opt.label === task.workMode);
            workModeCode = workModeOption?.value || '';
          }

          // Get task type code
          let taskTypeCode = task.defaultTaskTypeCode || '';
          if (task.type && !taskTypeCode) {
            // Try to find task type code from master data
            const taskTypeOptions = getTaskTypeOptions();
            const taskTypeOption = taskTypeOptions.find(opt => opt.label === task.type);
            taskTypeCode = taskTypeOption?.value || '';
          }

          // Get team code from team name
          let teamCode = '';
          if (task.team) {
            const teamCodeFromName = getTeamCodeFromName(task.team);
            teamCode = teamCodeFromName || '';
          }

          // Build new task object
          // Compute estimated_days from start/end dates (working days, inclusive)
          let estimatedDaysForTask = 1;
          if (task.startDate && task.dueDate) {
            const start = dayjs(task.startDate, "YYYY-MM-DD");
            const end = dayjs(task.dueDate, "YYYY-MM-DD");
            estimatedDaysForTask = countWorkingDaysInclusive(start, end);
          }

          newTasks[tempTaskId] = {
            task_title: task.title || '',
            task_description: task.description || '',
            priority_code: Number(task.priority) || 2,
            work_mode: workModeCode || '',
            // Backend now requires estimated_days in predefined_tasks; hours will be derived backend-side
            estimated_days: estimatedDaysForTask,
            is_billable: task.isBillable ?? true,
            due_date: task.dueDate || '',
            start_date: task.startDate || '',
            team_code: teamCode || null,
            task_type_code: taskTypeCode || '',
            status_code: task.defaultStatusCode || 'STS001',
          };

          // Also add this temp ID to predefined_task_ids so backend knows about it
          predefinedTaskIds.push(Number(tempTaskId));
        }
      }

      console.log('Extracted predefined task IDs:', {
        tasks: tasks.map(t => ({
          id: t.id,
          predefinedTaskId: t.predefinedTaskId,
          title: t.title,
          isNew: !t.predefinedTaskId || t.predefinedTaskId <= 0
        })),
        predefinedTaskIds,
        newTasksCount: Object.keys(newTasks).length
      });

      if (predefinedTaskIds.length === 0) {
        toast.error("No valid tasks available. Please ensure tasks are properly configured.");
        setLoading(false);
        return;
      }

      form.append("predefined_task_ids", JSON.stringify(predefinedTaskIds));

      // Add new_tasks if there are any
      if (Object.keys(newTasks).length > 0) {
        form.append("new_tasks", JSON.stringify(newTasks));
      }

      // Optional fields - only append if they have values
      if (epicTitle) form.append("epic_title", epicTitle);
      if (description) form.append("epic_description", description);
      if (product) form.append("product_code", product);
      if (priority) form.append("priority_code", String(priority));
      if (startDate) form.append("start_date", dayjs(startDate).format("YYYY-MM-DD"));
      if (dueDate) form.append("due_date", dayjs(dueDate).format("YYYY-MM-DD"));
      if (estimatedHours != null) {
        // Epic-level estimated_days: derive from hours (8h = 1 working day)
        const epicEstimatedDays = estimatedHours > 0 ? estimatedHours / 8 : 0;
        form.append("estimated_days", String(epicEstimatedDays));
      }
      form.append("is_billable", String(isBillable));
      if (client) form.append("company_code", client);
      if (contactPerson) form.append("contact_person_code", contactPerson);

      // Build task_teams JSON: mapping predefined_task_id to team_code
      const taskTeams: Record<string, string> = {};
      const taskAssignees: Record<string, string | null> = {};

      // Build task mappings using predefinedTaskId (numeric ID from database)
      // Keys in task_teams, task_assignees, task_type_codes, and task_dependencies
      // must match the IDs in predefined_task_ids array
      const taskTypeCodes: Record<string, string> = {};
      const taskDependencies: Record<string, number[]> = {};
      let taskIndex = 0;

      // Use the same ID allocation logic as above for mapping:
      // existing tasks use predefinedTaskId; new tasks get IDs after maxPredefinedTaskId.
      let mappingMaxPredefinedTaskId = 0;
      for (const t of tasks) {
        if (t.predefinedTaskId && t.predefinedTaskId > mappingMaxPredefinedTaskId) {
          mappingMaxPredefinedTaskId = t.predefinedTaskId;
        }
      }
      let newTaskCounterForMapping = mappingMaxPredefinedTaskId > 0 ? mappingMaxPredefinedTaskId + 1 : 1;

      for (const task of tasks) {
        let taskIdKey: string;

        if (task.predefinedTaskId && task.predefinedTaskId > 0) {
          // Existing predefined task
          taskIdKey = String(task.predefinedTaskId);
        } else {
          // New task - use the same temp ID range we used in new_tasks (1,2,... or max+1,...)
          taskIdKey = String(newTaskCounterForMapping++);
        }

        // Build dependency mapping from dependsOnTaskId when present
        if (task.dependsOnTaskId) {
          // Resolve dependency to corresponding key (predefinedTaskId or temp ID)
          let depTaskIdKey: string | undefined;
          const depTask = tasks.find(t => t.id === task.dependsOnTaskId);
          if (depTask?.predefinedTaskId && depTask.predefinedTaskId > 0) {
            depTaskIdKey = String(depTask.predefinedTaskId);
          }
          // If dependency is a new task without predefinedTaskId, approximate by position
          if (!depTaskIdKey) {
            const depIndex = tasks.findIndex(t => t.id === task.dependsOnTaskId);
            if (depIndex >= 0) {
              depTaskIdKey = String(10000 + depIndex);
            }
          }
          if (depTaskIdKey) {
            const depId = Number(depTaskIdKey);
            if (!Number.isNaN(depId)) {
              taskDependencies[taskIdKey] = [depId];
            }
          }
        }

        // Map team name to team_code
        if (task.team) {
          const teamCode = getTeamCodeFromName(task.team);
          if (teamCode) {
            taskTeams[taskIdKey] = teamCode;
          }
        }

        // Map assignee - task.assignee should be a user_code
        const assigneeValue = task.assignee?.trim();
        if (assigneeValue && assigneeValue.length > 0) {
          // Verify assignee exists in employee options
          const assigneeCode = employeeOptions.find(opt => opt.value === assigneeValue)?.value;
          if (assigneeCode) {
            taskAssignees[taskIdKey] = assigneeCode;
          } else {
            console.warn('Invalid assignee code for task:', taskIdKey, assigneeValue);
            // Don't add invalid assignees
          }
        }

        // Map task type code
        let taskTypeCode = task.defaultTaskTypeCode || '';
        if (task.type && !taskTypeCode) {
          // Try to find task type code from master data
          const taskTypeOptions = getTaskTypeOptions();
          const taskTypeOption = taskTypeOptions.find(opt => opt.label === task.type);
          taskTypeCode = taskTypeOption?.value || '';
        }
        if (taskTypeCode) {
          taskTypeCodes[taskIdKey] = taskTypeCode;
        }

        taskIndex++;
      }

      // Always append JSON mappings as strings (even if empty objects)
      // The API expects these fields, so send empty objects if no mappings
      form.append("task_teams", JSON.stringify(taskTeams));
      form.append("task_assignees", JSON.stringify(taskAssignees));
      form.append("task_type_codes", JSON.stringify(taskTypeCodes));
      form.append("task_dependencies", JSON.stringify(taskDependencies));

      console.log('Task mappings:', {
        task_teams: taskTeams,
        task_assignees: taskAssignees,
        task_type_codes: taskTypeCodes,
        predefined_task_ids: predefinedTaskIds,
        new_tasks: Object.keys(newTasks).length > 0 ? newTasks : undefined
      });

      if (files.length) {
        for (const f of files) {
          form.append("attachments", f);
        }
      }

      try {
        const { getUserFromStorage } = await import("../../../../lib/auth/storage");
        const user = getUserFromStorage();
        if (user?.userCode) form.append("reporter", String(user.userCode).trim().toUpperCase());
      } catch { }

      console.log('Creating epic from template with form data:', {
        predefined_epic_id: selectedEpic.id,
        predefined_task_ids: predefinedTaskIds,
        new_tasks: Object.keys(newTasks).length > 0 ? newTasks : undefined,
        epic_title: epicTitle || undefined,
        epic_description: description || undefined,
        product_code: product || undefined,
        priority_code: priority || undefined,
        start_date: startDate ? dayjs(startDate).format("YYYY-MM-DD") : undefined,
        due_date: dueDate ? dayjs(dueDate).format("YYYY-MM-DD") : undefined,
        estimated_hours: estimatedHours || undefined,
        is_billable: isBillable,
        company_code: client || undefined,
        contact_person_code: contactPerson || undefined,
        task_teams: Object.keys(taskTeams).length > 0 ? taskTeams : undefined,
        task_assignees: Object.keys(taskAssignees).length > 0 ? taskAssignees : undefined,
        task_type_codes: Object.keys(taskTypeCodes).length > 0 ? taskTypeCodes : undefined,
        tasks_count: tasks.length,
      });

      // Use use_existing_epic endpoint
      const epicResponse: any = await apiRequest("use_existing_epic", "POST", form);
      console.log('Epic creation response:', epicResponse);

      // Check if the response indicates failure
      if (epicResponse?.success === false || epicResponse?.success_flag === false) {
        const errorMsg = epicResponse?.message || epicResponse?.error || 'Epic creation failed';
        console.error('Epic creation failed:', errorMsg);
        throw new Error(errorMsg);
      }

      // Extract epic ID from data.id (as per API response structure)
      const epicId = epicResponse?.data?.id ||
        epicResponse?.data?.epic_id ||
        epicResponse?.epic_id ||
        epicResponse?.id;

      console.log('Extracted epic ID:', epicId);

      if (!epicId) {
        console.error('Epic response structure:', JSON.stringify(epicResponse, null, 2));
        throw new Error(`Failed to get epic ID from response. Response structure: ${JSON.stringify(epicResponse)}`);
      }

      // Tasks are automatically created by the use_existing_epic API
      // No need to create them individually
      console.log('Epic and tasks created successfully:', {
        epicId,
        message: epicResponse?.message || 'Epic created successfully',
      });

      toast.success(epicResponse?.message || `Epic created successfully with ${tasks.length} task(s)`);

      // Redirect to epics page with the epic expanded
      if (epicId) {
        // Delay navigation to allow user to see the success message
        setTimeout(() => {
          router.push(buildRoleHref(roleBase, `/epics?expandedEpic=${epicId}`));
        }, 2000);
      } else if (onCreated) {
        // If no epic ID, use the callback
        setTimeout(() => {
          onCreated();
        }, 2000);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to create epic";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsTemplate = () => {
    // For now, just log and show a toast; can be wired to a backend endpoint later.
    console.log("Save as template (epic) clicked", {
      epicTitle,
      description,
      startDate: startDate?.format("YYYY-MM-DD"),
      dueDate: dueDate?.format("YYYY-MM-DD"),
      isBillable,
      tasks,
    });
    toast.success("Current epic setup saved as template (stub - no backend yet)");
  };
       
  const taskColumns = [
    {
      title: "Task ID",
      key: "taskId",
      width: 100,
      render: (_: any, record: PredefinedTask, index: number) => {
        const taskId = record.taskId || `TA-${index + 1}`;
        const taskIdStr = record.taskId ? String(record.taskId) : `TA-${index + 1}`;
        const href = buildRoleHref(roleBase, `/tasks/${taskIdStr}`);

        return (
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              router.push(href);
            }}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
          >
            {record.taskId ? `TA-${record.taskId}` : `TA-${index + 1}`}
          </a>
        );
      },
    },
    {
      title: (
        <span>
          Title <span className="text-red-500">*</span>
        </span>
      ),
      key: "title",
      width: 220,
      render: (_: any, record: PredefinedTask) => (
        <AutoComplete
          value={record.title || ''}
          options={taskTitleOptions}
          onChange={(value) => handleTaskTitleChange(record.id, value)}
          onSelect={(value) => handleTaskTitleChange(record.id, value)}
          placeholder="Type to search or enter task title"
          size="small"
          className="w-full"
          filterOption={(inputValue, option) =>
            (option?.value as string)
              .toLowerCase()
              .includes(inputValue.toLowerCase())
          }
        />
      ),
    },
    {
      title: "Team",
      dataIndex: "team",
      key: "team",
      width: 150,
      render: (team: string, record: PredefinedTask) => (
        <Select
          value={team || undefined}
          onChange={(value) => {
            // Update team
            handleTaskFieldChange(record.id, "team", value);

            // If team changed, check if current assignee is in the new team
            if (value && record.assignee) {
              const newTeamEmployees = getEmployeesByTeam(value);
              const assigneeInNewTeam = newTeamEmployees.find(
                emp => emp.value === record.assignee || emp.label === record.assignee
              );

              // If assignee is not in the new team, clear the assignee
              if (!assigneeInNewTeam) {
                setTimeout(() => {
                  handleTaskFieldChange(record.id, "assignee", "");
                }, 0);
              }
            } else if (!value) {
              // If team is cleared, also clear assignee
              setTimeout(() => {
                handleTaskFieldChange(record.id, "assignee", "");
              }, 0);
            }
          }}
          placeholder="Select team"
          size="small"
          className="w-full"
          options={teamOptions}
          showSearch
          allowClear
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
          }
        />
      ),
    },
    {
      title: "Assignee",
      dataIndex: "assignee",
      key: "assignee",
      width: 180,
      render: (assignee: string, record: PredefinedTask) => {
        // Get filtered employees based on selected team
        const filteredEmployeeOptions = getEmployeesByTeam(record.team);

        // Find the value (code) if assignee is stored as name, or use assignee directly if it's a code
        const assigneeValue = (() => {
          if (!assignee) return undefined;
          // First check in filtered options
          const byName = filteredEmployeeOptions.find(opt => opt.label === assignee);
          if (byName) return byName.value;
          const byValue = filteredEmployeeOptions.find(opt => opt.value === assignee);
          if (byValue) return byValue.value;
          // If not found in filtered, check all employees (in case team was changed)
          const byNameAll = employeeOptions.find(opt => opt.label === assignee);
          if (byNameAll) return byNameAll.value;
          const byValueAll = employeeOptions.find(opt => opt.value === assignee);
          if (byValueAll) return byValueAll.value;
          return assignee;
        })();

        return (
          <Select
            value={assigneeValue}
            onChange={(value) => {
              // Store the employee code (value) for API submission
              handleTaskFieldChange(record.id, "assignee", value || "");
            }}
            placeholder={record.team ? "Select team member" : "Unassigned"}
            size="small"
            className="w-full"
            options={filteredEmployeeOptions}
            showSearch
            allowClear
            notFoundContent={record.team ? "No team members found" : "No employees found"}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
          />
        );
      },
    },
    {
      title: "Depends On",
      key: "dependsOn",
      width: 180,
      render: (_: any, record: PredefinedTask, index: number) => {
        // Build options from all other tasks
        const dependencyOptions = tasks
          .filter((t) => t.id !== record.id)
          .map((t, idx) => ({
            value: t.id,
            label: `TA-${idx + 1}: ${t.title || "Untitled task"}`,
          }));

        return (
          <Select
            value={record.dependsOnTaskId || undefined}
            onChange={(value) =>
              handleTaskFieldChange(
                record.id,
                "dependsOnTaskId",
                value || undefined
              )
            }
            size="small"
            className="w-full"
            placeholder="No dependency"
            options={dependencyOptions}
            allowClear
            disabled={tasks.length <= 1}
          />
        );
      },
    },
    {
      title: "Start Date",
      dataIndex: "startDate",
      key: "startDate",
      width: 130,
      render: (date: string, record: PredefinedTask, index: number) => {
        // Find the dependency task's due date (if any)
        const dependencyTask = record.dependsOnTaskId
          ? tasks.find((t) => t.id === record.dependsOnTaskId)
          : index > 0
          ? tasks[index - 1]
          : null;

        const dependencyDueDate = dependencyTask?.dueDate
          ? dayjs(dependencyTask.dueDate, "YYYY-MM-DD")
          : null;

        return (
          <DatePicker
            value={date ? dayjs(date, 'YYYY-MM-DD') : null}
            onChange={(d) => {
              const newStartDate = d ? d.format("YYYY-MM-DD") : "";
              handleTaskFieldChange(record.id, "startDate", newStartDate);
            }}
            format="DD/MM/YYYY"
            size="small"
            className="w-full"
            placeholder="Select start date"
            // If there is no dependency and the epic has a start date,
            // the task start date is locked to the epic start date,
            // so we disable manual editing in that case.
            disabled={!record.dependsOnTaskId && !!startDate}
            disabledDate={(current) => {
              // Disable dates before today
              if (current && current < dayjs().startOf('day')) {
                return true;
              }

              // If there is a dependency, enforce start after its due date (next working day)
              if (dependencyDueDate && dependencyDueDate.isValid()) {
                const minDate = getNextWorkingDay(dependencyDueDate).startOf("day");
                if (current && current < minDate) {
                  return true;
                }
              } else if (startDate) {
                // If no dependency, but epic has a start date, don't allow before epic start
                if (current && current < startDate.startOf("day")) {
                  return true;
                }
              }

              return false;
            }}
          />
        );
      },
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      width: 130,
      render: (date: string, record: PredefinedTask) => (
        <DatePicker
          value={date ? dayjs(date, 'YYYY-MM-DD') : null}
          onChange={(date) => {
            const newDueDate = date ? date.format("YYYY-MM-DD") : "";
            handleTaskFieldChange(record.id, "dueDate", newDueDate);
            // Mark this task as manually edited so epic due date changes don't overwrite it
            if (newDueDate) {
              setManuallyEditedTaskDueDates(prev => new Set(prev).add(record.id));
            }
          }}
          format="DD/MM/YYYY"
          size="small"
          className="w-full"
          placeholder="Select due date"
          disabledDate={(current) => {
            // Disable dates before task start date if set
            if (record.startDate) {
              const taskStartDate = dayjs(record.startDate, 'YYYY-MM-DD');
              if (taskStartDate.isValid()) {
                return current && current < taskStartDate.startOf('day');
              }
            }
            // Disable dates before epic start date if set
            if (startDate) {
              return current && current < startDate.startOf('day');
            }
            return false;
          }}
        />
      ),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      width: 120,
      render: (priority: string, record: PredefinedTask) => {
        // Get the current priority value (code)
        const priorityValue = priority || "2"; // Default to Medium (2)
        
        // Find the priority option
        const priorityOption = priorityOptions.find(opt => opt.value === priorityValue || opt.label === priorityValue);
        const currentValue = priorityOption?.value || priorityValue;
        const currentLabel = priorityOption?.label || "Medium";

        return (
          <Select
            value={currentValue}
            onChange={(value) => {
              handleTaskFieldChange(record.id, "priority", value);
            }}
            size="small"
            className="w-full"
            placeholder="Select priority"
            dropdownRender={(menu) => (
              <div>
                {menu}
              </div>
            )}
          >
            {priorityOptions.map(opt => (
              <Select.Option key={opt.value} value={opt.value}>
                <Tag 
                  color={opt.label === "High" ? "red" : opt.label === "Medium" ? "orange" : "blue"} 
                  className="text-xs"
                >
                  {opt.label}
                </Tag>
              </Select.Option>
            ))}
          </Select>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string, record: PredefinedTask) => {
        // Get status code from record (could be status or defaultStatusCode)
        const statusCode = status || record.defaultStatusCode || 'STS001';
        
        // Get status options to find the status description
        const statusOption = statusOptions.find(opt => opt.value === statusCode);
        const statusDescription = statusOption?.label || statusCode;
        
        // Get display label and color
        const displayLabel = getStatusDisplayLabel(statusDescription);
        const tagColor = statusTagColor(statusDescription);
        
        return (
          <Tag color={tagColor} className="text-xs">
            {displayLabel}
          </Tag>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      fixed: "right" as const,
      render: (_: any, record: PredefinedTask) => (
        <button
          type="button"
          onClick={() => handleDeleteTask(record.id)}
          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded transition-colors"
          title="Delete task"
          disabled={loading}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      ),
    },
  ];

  const templateOptions = predefinedEpics.map(epic => ({
    value: epic.id,
    label: epic.name,
  }));

  return (
    <div>
      {/* Template Selection */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 pb-1.5 border-b border-gray-200">Select Template</h2>
        <div className="mb-4">
          <label className={labelCls}>Predefined Epic Template{required}</label>
          <Select
            placeholder={loadingEpics ? "Loading templates..." : "Select a predefined epic template"}
            className="w-full rounded-md"
            size="middle"
            value={selectedTemplateId || undefined}
            onChange={(val) => {
              handleTemplateSelect(val);
              handleFieldChange('selectedTemplateId', val, setSelectedTemplateId);
            }}
            onBlur={() => handleFieldBlur('selectedTemplateId', selectedTemplateId)}
            status={errors.selectedTemplateId ? 'error' : ''}
            options={templateOptions}
            loading={loadingEpics}
            disabled={loadingEpics}
            showSearch
            notFoundContent={loadingEpics ? "Loading..." : "No templates found"}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
          />
          {errors.selectedTemplateId && (
            <div className="text-xs text-red-600 mt-1">{errors.selectedTemplateId}</div>
          )}
        </div>
      </div>

      {/* Epic Details View - Only shown when template is selected */}
      {selectedEpic && (
        <>
          {/* Basic Information Section */}
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 pb-1.5 border-b border-gray-200">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
              {/* Epic Title */}
              <div className="md:col-span-2">
                <label className={labelCls}>Epic Title{required}</label>
                <Input
                  placeholder="Enter epic title"
                  size="middle"
                  value={epicTitle}
                  onChange={(e) => handleFieldChange('epicTitle', e.target.value, setEpicTitle)}
                  onBlur={() => handleFieldBlur('epicTitle', epicTitle)}
                  status={errors.epicTitle ? 'error' : ''}
                  className="rounded-md"
                />
                {errors.epicTitle && (
                  <div className="text-xs text-red-600 mt-1">{errors.epicTitle}</div>
                )}
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className={labelCls}>Description{required}</label>
                <Input.TextArea
                  placeholder="Enter a detailed description of the epic"
                  rows={3}
                  className="text-sm rounded-md"
                  value={description}
                  onChange={(e) => handleFieldChange('description', e.target.value, setDescription)}
                  onBlur={() => handleFieldBlur('description', description)}
                  status={errors.description ? 'error' : ''}
                />
                {errors.description && (
                  <div className="text-xs text-red-600 mt-1">{errors.description}</div>
                )}
              </div>
            </div>
          </div>

          {/* Time & Resources Section */}
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 pb-1.5 border-b border-gray-200">Time & Resources</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">

              {/* Estimated Hours */}
              <div>
                <label className={labelCls}>Estimated Hours{required}</label>
                <InputNumber
                  size="middle"
                  min={0}
                  step={0.5}
                  className="w-full rounded-md"
                  value={estimatedHours ?? undefined}
                  status={errors.estimatedHours ? 'error' : ''}
                  onChange={(v) => {
                    const n = Number(v);
                    const value = Number.isFinite(n) ? n : null;
                    handleFieldChange('estimatedHours', value, setEstimatedHours);
                  }}
                  onBlur={() => handleFieldBlur('estimatedHours', estimatedHours)}
                  onFocus={() => setEstimatedHours(null)}
                  onKeyDown={handleNumberKeyDown}
                />
                {errors.estimatedHours && (
                  <div className="text-xs text-red-600 mt-1">{errors.estimatedHours}</div>
                )}
              </div>

              {/* Estimated Days (calculated from estimated hours) */}
              <div>
                <label className={labelCls}>Estimated Days</label>
                <InputNumber
                  placeholder="0"
                  size="middle"
                  className="w-full rounded-md"
                  addonAfter={<CalendarOutlined className="text-gray-400" />}
                  value={estimatedDays ?? undefined}
                  precision={2}
                  disabled
                  style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {estimatedDays != null 
                    ? `Based on ${estimatedHours} hours (8 hours = 1 working day)`
                    : 'Enter estimated hours to calculate days'}
                </div>
              </div>

              {/* Reporter */}
              <div>
                <label className={labelCls}>Reporter{required}</label>
                <Input
                  value={reporterName}
                  placeholder="Reporter"
                  size="middle"
                  disabled
                  className="rounded-md bg-gray-50"
                />
              </div>

              {/* Billable */}
              <div>
                <label className={labelCls}>Billable</label>
                <div className="flex items-center gap-3 pt-1">
                  <ToggleSwitch checked={isBillable} onChange={setIsBillable} />
                  <span className="text-xs text-gray-600">Is billable</span>
                </div>
              </div>
            </div>
          </div>

          {/* Epic Details Section */}
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 pb-1.5 border-b border-gray-200">Epic Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
              {/* Priority */}
              <div>
                <label className={labelCls}>Priority{required}</label>
                <Select
                  placeholder="Select priority"
                  size="middle"
                  className="w-full rounded-md"
                  value={priority || undefined}
                  onChange={(val) => handleFieldChange('priority', val, setPriority)}
                  onBlur={() => handleFieldBlur('priority', priority)}
                  status={errors.priority ? 'error' : ''}
                  options={priorityOptions}
                />
                {errors.priority && (
                  <div className="text-xs text-red-600 mt-1">{errors.priority}</div>
                )}
              </div>

              {/* Product */}
              <div>
                <label className={labelCls}>Product{required}</label>
                <Select
                  placeholder="Select product"
                  size="middle"
                  className="w-full rounded-md"
                  value={product || undefined}
                  onChange={(val) => handleFieldChange('product', val, setProduct)}
                  onBlur={() => handleFieldBlur('product', product)}
                  status={errors.product ? 'error' : ''}
                  options={productOptions}
                  showSearch
                  allowClear
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                />
                {errors.product && (
                  <div className="text-xs text-red-600 mt-1">{errors.product}</div>
                )}
              </div>

              {/* Client */}
              <div>
                <label className={labelCls}>Client{required}</label>
                <Select
                  showSearch
                  placeholder={clientOptions.length === 0 ? "Loading clients..." : "Select client"}
                  size="middle"
                  className="w-full rounded-md"
                  value={client || undefined}
                  onChange={(val) => {
                    console.log('Client selected:', val);
                    handleFieldChange('client', val, setClient);
                  }}
                  onBlur={() => handleFieldBlur('client', client)}
                  status={errors.client ? 'error' : ''}
                  options={clientOptions}
                  allowClear
                  notFoundContent={clientOptions.length === 0 ? "No clients available" : "No clients found"}
                  loading={clientOptions.length === 0}
                  filterOption={(input, option) => {
                    const label = (option?.label as string) || '';
                    return label.toLowerCase().includes(input.toLowerCase());
                  }}
                />
                {errors.client && (
                  <div className="text-xs text-red-600 mt-1">{errors.client}</div>
                )}
                {clientOptions.length === 0 && (
                  <div className="text-xs text-yellow-600 mt-1">Client options are loading. Please ensure master data is loaded.</div>
                )}
              </div>

              {/* Contact Person */}
              <div>
                <label className={labelCls}>Contact Person{required}</label>
                <Select
                  showSearch
                  placeholder={client ? "Select contact person" : "Select client first"}
                  size="middle"
                  className="w-full rounded-md"
                  value={contactPerson || undefined}
                  onChange={(val) => handleFieldChange('contactPerson', val, setContactPerson)}
                  onBlur={() => handleFieldBlur('contactPerson', contactPerson)}
                  status={errors.contactPerson ? 'error' : ''}
                  options={contactPersonOptions}
                  disabled={!client}
                  allowClear
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                />
                {errors.contactPerson && (
                  <div className="text-xs text-red-600 mt-1">{errors.contactPerson}</div>
                )}
              </div>

              {/* Start Date */}
              <div>
                <label className={labelCls}>Start Date{required}</label>
                <DatePicker
                  placeholder="Select start date"
                  size="middle"
                  className="w-full rounded-md"
                  format="DD-MM-YYYY"
                  value={startDate}
                  onChange={(val) => handleFieldChange('startDate', val, setStartDate)}
                  onBlur={() => handleFieldBlur('startDate', startDate)}
                  status={errors.startDate ? 'error' : ''}
                  suffixIcon={<CalendarOutlined className="text-gray-400" />}
                  disabledDate={(current) => {
                    if (current && current < dayjs().startOf('day')) return true;
                    if (dueDate) return current && current > dueDate.endOf('day');
                    return false;
                  }}
                />
                {errors.startDate && (
                  <div className="text-xs text-red-600 mt-1">{errors.startDate}</div>
                )}
              </div>

              {/* Due Date */}
              <div>
                <label className={labelCls}>Due Date{required}</label>
                <DatePicker
                  placeholder="Select due date"
                  size="middle"
                  className="w-full rounded-md"
                  format="DD-MM-YYYY"
                  value={dueDate}
                  onChange={(val) => handleFieldChange('dueDate', val, setDueDate)}
                  onBlur={() => handleFieldBlur('dueDate', dueDate)}
                  status={errors.dueDate ? 'error' : ''}
                  suffixIcon={<CalendarOutlined className="text-gray-400" />}
                  disabledDate={(current) => {
                    if (startDate) return current && current < startDate.startOf('day');
                    return false;
                  }}
                />
                {errors.dueDate && (
                  <div className="text-xs text-red-600 mt-1">{errors.dueDate}</div>
                )}
                {!errors.dueDate && startDate && estimatedDays != null && estimatedDays > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    Auto-calculated from start date ({startDate.format('DD-MM-YYYY')}) + {estimatedDays} working days (skips weekends)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Attachments Section */}
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 pb-1.5 border-b border-gray-200">Attachments</h2>
            <div>
              <label className={labelCls}>Upload Files</label>
              <Upload.Dragger
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt"
                beforeUpload={(file) => {
                  setFiles((prev) => [...prev, file as File]);
                  const fileWithUid = file as File & { uid?: string };
                  setUploadList((prev) => [
                    ...prev,
                    { uid: fileWithUid.uid || `${Date.now()}-${file.name}`, name: file.name, size: file.size, type: file.type, status: 'done' as const, originFileObj: file },
                  ]);
                  return false;
                }}
                onRemove={(file) => {
                  setUploadList((prev) => prev.filter((f) => f.uid !== file.uid));
                  setFiles((prev) => prev.filter((f) => f.name !== file.name || f.size !== (file.size || 0)));
                }}
                fileList={uploadList}
                className="rounded-md"
              >
                <div className="text-center py-4">
                  <p className="text-sm text-gray-600 mb-1">Drag and drop files here or click to browse</p>
                  <p className="text-xs text-gray-400">Supported: pdf, images, docs, sheets, txt</p>
                </div>
              </Upload.Dragger>
              {uploadList.length > 0 && (
                <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                  <span>{uploadList.length} file(s) selected</span>
                  <button
                    type="button"
                    className="underline hover:text-gray-800"
                    onClick={() => { setUploadList([]); setFiles([]); }}
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tasks Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Tasks ({tasks.length} task(s))
                {selectedTaskIds.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-blue-600">
                    ({selectedTaskIds.length} selected)
                  </span>
                )}
              </h3>
              <div className="flex gap-2">
                {selectedTaskIds.length > 0 && (
                  <Button
                    type="default"
                    danger
                    size="small"
                    onClick={handleDeleteSelectedTasks}
                    disabled={loading}
                    className="text-xs"
                  >
                    Delete Selected ({selectedTaskIds.length})
                  </Button>
                )}
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={handleAddTask}
                  className="text-xs"
                >
                  Add Task
                </Button>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <Table
                columns={taskColumns}
                dataSource={tasks}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
                className="text-xs"
                rowSelection={{
                  selectedRowKeys: selectedTaskIds,
                  onChange: (selectedRowKeys) => {
                    setSelectedTaskIds(selectedRowKeys);
                  },
                  getCheckboxProps: (record) => ({
                    disabled: loading,
                  }),
                }}
              />
            </div>
          </div>

          {/* Gantt Chart */}
          {tasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Timeline View (Gantt Chart)</h3>
              <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                <SimpleGanttChart tasks={tasks} />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            {onCancel && (
              <Button
                onClick={onCancel}
                disabled={loading}
                size="middle"
                className="px-5 rounded-md"
              >
                Cancel
              </Button>
            )}
            <Button
              type="primary"
              onClick={handleCreateEpic}
              loading={loading}
              disabled={tasks.length === 0 || loading}
              icon={<CheckOutlined />}
              size="middle"
              className="px-6 rounded-md bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Creating...' : `Create Epic with ${tasks.length} Task(s)`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
