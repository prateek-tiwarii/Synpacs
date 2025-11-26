import React, { useState, useEffect } from 'react';
import { Eye, Trash2, Plus, Users, Loader2, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiService } from '@/lib/api';
import { useUser } from '@/hooks/useUser';
import InstitutionsManager from '@/components/dashboard/CreateInstitute';

const USER_ROLES = [
  { value: 'doctor', label: 'Doctor/Radiologist' },
  { value: 'technician', label: 'Technician' },
  { value: 'admin', label: 'Admin' },
  { value: 'referring_doctor', label: 'Referring Doctor' },
  { value: 'typist', label: 'Typist/Transcriptionist' },
  { value: 'coordinator', label: 'Coordinator' }
];

const ROLE_COLORS = {
  doctor: 'bg-blue-100 text-blue-800',
  technician: 'bg-green-100 text-green-800',
  admin: 'bg-purple-100 text-purple-800',
  referring_doctor: 'bg-orange-100 text-orange-800',
  typist: 'bg-pink-100 text-pink-800',
  coordinator: 'bg-yellow-100 text-yellow-800'
};

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' }
];

const UserDialog = ({ open, onOpenChange, onSave }: any) => {
  const [formData, setFormData] = useState({
    role: 'doctor',
    fullName: '',
    email: '',
    phone: '',
    speciality: '',
    availableDays: [] as string[],
    availableTimes: [{ startTime: '', endTime: '' }],
    onCall: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    setFormData({
      role: 'doctor',
      fullName: '',
      email: '',
      phone: '',
      speciality: '',
      availableDays: [],
      availableTimes: [{ startTime: '', endTime: '' }],
      onCall: false
    });
    setError('');
  }, [open]);

  const addTimeSlot = () => {
    setFormData({
      ...formData,
      availableTimes: [...formData.availableTimes, { startTime: '', endTime: '' }]
    });
  };

  const removeTimeSlot = (index: number) => {
    const newTimes = formData.availableTimes.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      availableTimes: newTimes.length > 0 ? newTimes : [{ startTime: '', endTime: '' }]
    });
  };

  const updateTimeSlot = (index: number, field: 'startTime' | 'endTime', value: string) => {
    const newTimes = [...formData.availableTimes];
    newTimes[index][field] = value;
    setFormData({
      ...formData,
      availableTimes: newTimes
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await onSave(formData);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save user');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&>button]:bg-white! [&>button]:text-red-600! [&>button]:hover:bg-white! [&>button]:hover:text-red-700!">
        <DialogHeader>
          <DialogTitle>Create User Account</DialogTitle>
          <DialogDescription>
            Fill in the required fields based on user role
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="fullName">Name *</Label>
            <Input
              id="fullName"
              placeholder="Enter full name"
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              required
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              placeholder="+91-98765-43210"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              required
            />
          </div>

          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>

          <div>
            <Label htmlFor="role">Role *</Label>
            <Select 
              value={formData.role} 
              onValueChange={(value) => {
                setFormData({
                  ...formData, 
                  role: value,
                  // Clear doctor-specific fields when changing role
                  speciality: value === 'doctor' ? formData.speciality : '',
                  availableDays: value === 'doctor' ? formData.availableDays : [],
                  availableTimes: value === 'doctor' ? formData.availableTimes : [{ startTime: '', endTime: '' }],
                  onCall: value === 'doctor' ? formData.onCall : false
                });
              }}
            >
              <SelectTrigger className="bg-white! text-gray-900!">
                <SelectValue placeholder="Select user role" />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map(role => (
                  <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.role === 'doctor' && (
            <>
              <div>
                <Label htmlFor="speciality">Speciality *</Label>
                <Input
                  id="speciality"
                  placeholder="e.g., Cardiology, Radiology"
                  value={formData.speciality}
                  onChange={(e) => setFormData({...formData, speciality: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-3 flex flex-col gap-2">
                <Label>Available Days *</Label>
                <div className="grid grid-cols-2 gap-3">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={day.value}
                        checked={formData.availableDays.includes(day.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              availableDays: [...formData.availableDays, day.value]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              availableDays: formData.availableDays.filter((d) => d !== day.value)
                            });
                          }
                        }}
                      />
                      <label
                        htmlFor={day.value}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {day.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Available Times *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTimeSlot}
                    className="h-8 bg-white! text-gray-700! border-gray-300 hover:bg-gray-100!"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Time Slot
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.availableTimes.map((timeSlot, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <Input
                            type="time"
                            placeholder="Start Time"
                            value={timeSlot.startTime}
                            onChange={(e) => updateTimeSlot(index, 'startTime', e.target.value)}
                            required
                            className="bg-white"
                          />
                        </div>
                        <div>
                          <Input
                            type="time"
                            placeholder="End Time"
                            value={timeSlot.endTime}
                            onChange={(e) => updateTimeSlot(index, 'endTime', e.target.value)}
                            required
                            className="bg-white"
                          />
                        </div>
                      </div>
                      {formData.availableTimes.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTimeSlot(index)}
                          className="h-9 w-9 p-0 text-red-600 hover:bg-red-50! hover:text-red-700!"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">Add multiple time slots for different availability windows throughout the day</p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="onCall"
                  checked={formData.onCall}
                  onCheckedChange={(checked) => setFormData({...formData, onCall: checked === true})}
                />
                <label
                  htmlFor="onCall"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Available On Call
                </label>
              </div>
            </>
          )}

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-white! text-black! border-gray-300" disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" className="bg-black! text-white! hover:bg-gray-800!" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const DeleteConfirmationModal = ({ open, onOpenChange, user, onConfirm, isDeleting }: any) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md [&>button]:bg-white! [&>button]:text-red-600! [&>button]:hover:bg-white! [&>button]:hover:text-red-700!">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-full">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-xl">Delete User</DialogTitle>
          </div>
          <DialogDescription className="pt-4">
            Are you sure you want to delete this user? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        {user && (
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div>
              <span className="text-sm font-medium text-gray-700">Name: </span>
              <span className="text-sm text-gray-900">{user.fullName}</span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Email: </span>
              <span className="text-sm text-gray-900">{user.email}</span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Role: </span>
              <Badge className={ROLE_COLORS[user.role as keyof typeof ROLE_COLORS]}>
                {USER_ROLES.find(r => r.value === user.role)?.label || user.role}
              </Badge>
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="bg-white! text-black! border-gray-300 hover:bg-gray-100!"
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={onConfirm}
            className="bg-red-600! text-white! hover:bg-red-700!"
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete User'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const UsersTable = ({ users, onView, onDelete, currentUserId }: any) => {
  const getRoleLabel = (roleValue: string) => {
    const role = USER_ROLES.find(r => r.value === roleValue);
    return role ? role.label : roleValue;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Phone Number</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Added On</TableHead>
          <TableHead>Added By</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user: any) => {
          const isCurrentUser = user.id === currentUserId;
          return (
            <TableRow key={user.id} className={isCurrentUser ? "bg-blue-50/50" : ""}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <span>{user.fullName}</span>
                  {isCurrentUser && (
                    <Badge className="bg-blue-100 text-blue-800 text-xs">You</Badge>
                  )}
                </div>
                {user.note && <div className="text-xs text-gray-500">{user.note}</div>}
              </TableCell>
              <TableCell>
                <Badge className={ROLE_COLORS[user.role as keyof typeof ROLE_COLORS]}>
                  {getRoleLabel(user.role)}
                </Badge>
              </TableCell>
              <TableCell>{user.phone}</TableCell>
              <TableCell className="text-blue-600">{user.email}</TableCell>
              <TableCell className="text-sm text-gray-600">{formatDate(user.addedOn)}</TableCell>
              <TableCell className="text-sm text-gray-700">{user.addedBy || '—'}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onView(user)}
                    disabled={isCurrentUser}
                    className="h-8 w-8 p-0 bg-white! text-gray-700! border-gray-300 hover:bg-gray-100! disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isCurrentUser ? "Cannot view your own profile here" : "View user"}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onDelete(user)}
                    disabled={isCurrentUser}
                    className="h-8 w-8 p-0 bg-white! text-red-600! border-gray-300 hover:bg-red-50! disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isCurrentUser ? "You cannot delete yourself" : "Delete user"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};


// ...existing code...
// Removed InstitutionDialog and InstitutionManager components
// ...existing code...

const UserCreate = () => {
  const { user: currentUser } = useUser();
  const [users, setUsers] = useState<any[]>([]);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response: any = await apiService.getAllUsers();
      
      if (response.success && response.data) {
        const mappedUsers = response.data.map((user: any) => ({
          id: user._id,
          role: user.role,
          fullName: user.full_name,
          displayName: user.full_name,
          phone: user.phone,
          email: user.email,
          addedOn: user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : '',
          addedBy: user.created_by?.full_name || '—',
          isActive: user.is_active,
          hospitalId: user.hospital_id,
          lastLogin: user.last_login,
        }));
        setUsers(mappedUsers);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = () => {
    setUserDialogOpen(true);
  };

  const handleViewUser = (user: any) => {
    // View functionality can be implemented here if needed
    console.log('View user:', user);
  };

  const handleDeleteUser = (user: any) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      setIsDeleting(true);
      await apiService.deleteUser(userToDelete.id);
      
      setUsers(users.filter((u: any) => u.id !== userToDelete.id));
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (err: any) {
      console.error('Error deleting user:', err);
      alert(err.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveUser = async (userData: any) => {
    if (userData.role === 'doctor') {
      // Use doctor-specific endpoint for doctors
      const doctorPayload = {
        email: userData.email,
        full_name: userData.fullName,
        phone: userData.phone,
        speciality: userData.speciality,
        availability: [
          {
            available_days: userData.availableDays,
            available_times: userData.availableTimes
              .filter((slot: any) => slot.startTime && slot.endTime)
              .map((slot: any) => `${slot.startTime}-${slot.endTime}`),
            on_call: userData.onCall
          }
        ]
      };
      
      await apiService.createDoctor(doctorPayload);
    } else {
      // Use generic user endpoint for other roles
      const userPayload = {
        email: userData.email,
        full_name: userData.fullName,
        phone: userData.phone,
        role: userData.role
      };
      
      await apiService.createUser(userPayload);
    }
    
    await fetchUsers();
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.specialty && user.specialty.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.department && user.department.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  return (
    <DashboardLayout>
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-medium text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7" />
            User Management
          </div>
          <p className="text-sm text-gray-500 mt-1">Create and manage users across all roles - Doctors, Technicians, Admins, and more</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Total Users:</span>
          <span className="text-lg font-semibold text-gray-900">{users.length} / 50</span>
        </div>
      </div>

      <div className="space-y-6">
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-white">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-medium">All Users ({filteredUsers.length})</CardTitle>
                <CardDescription>Manage users of all roles in your organization</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-48 bg-white! text-gray-900!">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {USER_ROLES.map(role => (
                      <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-3 pr-4 py-2 w-64 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                  />
                </div>
                <Button onClick={handleAddUser} className="gap-2 bg-black! text-white! hover:bg-gray-800!">
                  <Plus className="w-4 h-4" />
                  Add User
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-3 text-gray-600">Loading users...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="text-red-600 text-sm bg-red-50 p-4 rounded-lg max-w-md">
                  {error}
                </div>
                <Button 
                  onClick={fetchUsers} 
                  variant="outline" 
                  className="mt-4 bg-white! text-gray-900!"
                >
                  Try Again
                </Button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Users className="h-12 w-12 mb-3 text-gray-300" />
                <p className="text-lg font-medium">No users found</p>
                <p className="text-sm">Click "Add User" to create your first user</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <UsersTable 
                  users={filteredUsers} 
                  onView={handleViewUser}
                  onDelete={handleDeleteUser}
                  currentUserId={currentUser?._id}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <UserDialog 
        open={userDialogOpen} 
        onOpenChange={setUserDialogOpen}
        onSave={handleSaveUser}
      />

      <DeleteConfirmationModal
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        user={userToDelete}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
      />

      <div className="pt-12 border-t border-gray-200">
        <InstitutionsManager />
      </div>
    </div>
    </DashboardLayout>
  );
};



export default UserCreate;