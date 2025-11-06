# Role-Based Dashboard Implementation

## Overview

I've implemented a complete role-based authentication and routing system for your application with three roles:

- **doctor** - Sees a patient list dashboard
- **coordinator** - Sees the standard dashboard with worklist, PAC list, and automation
- **super_coordinator** - Has all coordinator permissions plus user creation

## Files Created/Modified

### 1. **New Doctor Dashboard** (`src/pages/DoctorDashboard.tsx`)

- Displays assigned patient cases with filtering and search
- Shows 4 stat cards: Total Cases, Pending Review, In Progress, Critical Cases
- Patient list with:
  - Patient name, ID, accession number
  - Study type, modality
  - Priority badges (STAT, Critical, Routine)
  - Status badges (Pending Review, In Progress, Completed)
  - Assigned date and time
  - Action buttons (Open Study, View Details)
- Search by patient name, ID, or accession number
- Filter by status (All, Pending, In Progress)

### 2. **Role-Based Route Component** (`src/components/RoleBasedRoute.tsx`)

- Protects routes based on user role
- Automatically fetches user data if not loaded
- Redirects users to appropriate dashboard based on their role:
  - `doctor` → `/doctor-dashboard`
  - `super_coordinator`, `coordinator` → `/dashboard`
- Shows loading spinner while fetching user data

### 3. **Updated App.tsx**

- Added `RootRedirect` component that checks user role and redirects accordingly
- Wrapped all routes with `RoleBasedRoute` component
- Role-specific routes:
  - **Doctor routes**: `/doctor-dashboard` (only doctors)
  - **Coordinator routes**: `/dashboard`, `/worklist`, `/pac-list`, `/automation` (coordinators and super_coordinators)
  - **Super Coordinator routes**: `/User-Create` (only super_coordinators)

### 4. **Updated Sidebar** (`src/components/Sidebar.tsx`)

- Dynamically shows menu items based on user role
- **Doctor sees**:
  - My Cases
- **Coordinator sees**:
  - Dashboard
  - Worklist
  - PAC List
  - Automation
- **Super Coordinator sees** (all coordinator items plus):
  - Create User

## Backend Updates Needed

### 1. **Auth Controller** (Your backend)

The current implementation is good, but ensure the token includes role information and the user object is properly returned.

**Current flow is correct:**

```typescript
// Login - returns token
const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
  expiresIn: "1h",
});

// Get user - returns full user object with role
const user = await User.findById(req.user._id).select("-password_hash");
```

### 2. **Auth Middleware** (Your backend)

The current implementation is correct. It:

- Verifies JWT token
- Fetches user from database
- Attaches user to request object
- Checks if user is active

## How It Works

### Login Flow:

1. User enters credentials → `Auth.tsx`
2. Backend validates and returns JWT token → stored in cookie
3. Frontend sets `isAuthenticated = true`
4. User redirected to root `/`
5. `RootRedirect` component:
   - Fetches user data from `/api/v1/auth/get-user`
   - Checks user role
   - Redirects to appropriate dashboard:
     - Doctor → `/doctor-dashboard`
     - Coordinator/Super Coordinator → `/dashboard`

### Route Protection:

- All routes wrapped with `RoleBasedRoute`
- Component checks if user has required role
- If not, redirects to appropriate dashboard
- Example: Doctor tries to access `/dashboard` → redirected to `/doctor-dashboard`

### Sidebar Navigation:

- Sidebar reads user role from Redux store
- Dynamically generates menu items using `getSidebarItems(role)`
- Only shows items user has permission to access

## Testing

### Test as Doctor:

1. Login with doctor credentials
2. Should see `/doctor-dashboard` with patient list
3. Sidebar shows only "My Cases"
4. Cannot access `/dashboard`, `/worklist`, etc.

### Test as Coordinator:

1. Login with coordinator credentials
2. Should see `/dashboard` (original dashboard)
3. Sidebar shows: Dashboard, Worklist, PAC List, Automation
4. Cannot access `/User-Create`

### Test as Super Coordinator:

1. Login with super_coordinator credentials
2. Should see `/dashboard` (original dashboard)
3. Sidebar shows all items including "Create User"
4. Can access all routes

## Next Steps

1. **Connect to Real API**: Replace mock data in `DoctorDashboard.tsx` with actual API calls
2. **Add More Doctor Features**:
   - Report writing interface
   - Image viewer integration
   - Case history
   - Communication with coordinators
3. **Role-Based Features**: Add more role-specific features as needed
4. **Permissions**: Add granular permissions within each role

## Security Notes

- JWT token stored in httpOnly cookie (secure)
- Token verified on every request (middleware)
- User role checked on both frontend (UX) and backend (security)
- Frontend role checks are for UX only - backend must enforce permissions
- Always validate permissions on backend API endpoints
