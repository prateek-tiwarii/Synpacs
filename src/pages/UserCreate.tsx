import React, { useState, useEffect } from 'react';
import { Eye, Edit2, Trash2, Plus, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiService } from '@/lib/api';

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

const UserDialog = ({ open, onOpenChange, user, onSave }: any) => {
  const [formData, setFormData] = useState(user || {
    role: 'doctor',
    fullName: '',
    email: '',
    phone: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (user) {
      setFormData(user);
    } else {
      setFormData({
        role: 'doctor',
        fullName: '',
        email: '',
        phone: ''
      });
    }
    setError('');
  }, [user, open]);

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
          <DialogTitle>{user ? 'Edit User Account' : 'Create User Account'}</DialogTitle>
          <DialogDescription>
            {user ? 'Update user information' : 'Fill in the required fields based on user role'}
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
              onValueChange={(value) => setFormData({...formData, role: value})}
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
              {isLoading ? 'Saving...' : user ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const UsersTable = ({ users, onEdit, onView, onDelete }: any) => {
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
        {users.map((user: any) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">
              <div>{user.fullName}</div>
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
                  className="h-8 w-8 p-0 bg-white! text-gray-700! border-gray-300 hover:bg-gray-100!"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onEdit(user)}
                  className="h-8 w-8 p-0 bg-white! text-gray-700! border-gray-300 hover:bg-gray-100!"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onDelete(user.id)}
                  className="h-8 w-8 p-0 bg-white! text-red-600! border-gray-300 hover:bg-red-50!"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};


const UserCreate = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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
    setSelectedUser(null);
    setUserDialogOpen(true);
  };

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setUserDialogOpen(true);
  };

  const handleViewUser = (user: any) => {
    setSelectedUser(user);
    setUserDialogOpen(true);
  };

  const handleDeleteUser = (id: any) => {
    if (confirm('Are you sure you want to delete this user?')) {
      setUsers(users.filter((u: any) => u.id !== id));
    }
  };

  const handleSaveUser = async (userData: any) => {
    if (selectedUser) {
      setUsers(users.map((u: any) => u.id === selectedUser.id ? {...userData, id: selectedUser.id} : u));
    } else {
      const apiPayload = {
        email: userData.email,
        full_name: userData.fullName,
        phone: userData.phone,
        role: userData.role
      };
      
      await apiService.createUser(apiPayload);
      
      await fetchUsers();
    }
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
                  onEdit={handleEditUser}
                  onView={handleViewUser}
                  onDelete={handleDeleteUser}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <UserDialog 
        open={userDialogOpen} 
        onOpenChange={setUserDialogOpen}
        user={selectedUser}
        onSave={handleSaveUser}
      />
    </div>
    </DashboardLayout>
  );
};



export default UserCreate;