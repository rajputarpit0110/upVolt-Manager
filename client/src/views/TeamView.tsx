import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, KeyRound, ShieldCheck, UserX, Check, Lock, Building2 } from 'lucide-react';
import { User, Role } from '../types';
import { userApi, collegeApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Common/Toast';
import { Modal } from '../components/Common/Modal';

export const TeamView: React.FC = () => {
  const { user: currentUser, isMasterAdmin } = useAuth();
  const { success, error } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [collegesList, setCollegesList] = useState<string[]>([
    'KIET Group of Institutions',
    'ABES Engineering College',
    'AKGEC Ghaziabad',
    'Galgotias University',
    'GL Bajaj Institute',
    'IIT Bombay',
  ]);
  const [isLoading, setIsLoading] = useState(true);

  // Create User Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(isMasterAdmin ? 'MEMBER' : 'COLLEGE_MEMBER');
  const [college, setCollege] = useState('');
  const [customCollege, setCustomCollege] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset Password Modal
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    loadUsers();
    loadColleges();
  }, []);

  const loadColleges = async () => {
    try {
      const res = await collegeApi.getColleges();
      if (res.success && res.colleges && res.colleges.length > 0) {
        setCollegesList(res.colleges);
      }
    } catch (e) {
      // Fallback already in initial state
    }
  };

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const res = await userApi.getAll();
      if (res.success) setUsers(res.users);
    } catch (err: any) {
      error(err.message || 'Failed to load team users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setUsername('');
    setName('');
    setEmail('');
    setPassword('');
    setRole(isMasterAdmin ? 'MEMBER' : 'COLLEGE_MEMBER');
    setCollege('');
    setCustomCollege('');
    setIsCreateModalOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      error('Password must be at least 6 characters long', 'Password Too Short');
      return;
    }

    const assignedCollege =
      role === 'COLLEGE_MEMBER' || role === 'CAMPUS_EXECUTIVE'
        ? college === '__CUSTOM__'
          ? customCollege.trim()
          : college.trim()
        : undefined;

    // Both College Executive and Distributive Agent strictly require a college
    if ((role === 'COLLEGE_MEMBER' || role === 'CAMPUS_EXECUTIVE') && !assignedCollege) {
      error(
        `Please select or specify the target college for this ${
          role === 'COLLEGE_MEMBER' ? 'College Executive' : 'Campus Distributive Agent'
        }.`,
        'College Required'
      );
      return;
    }

    if (
      role === 'MASTER_ADMIN' &&
      !window.confirm(
        `Are you sure you want to create "${name}" as a MASTER ADMIN? This user will have full destructive privileges and access to all financial data.`
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await userApi.create({
        userId: username.toLowerCase().trim(),
        username: username.toLowerCase().trim(),
        name: name.trim(),
        email: email.trim() || undefined,
        password,
        role,
        college: assignedCollege,
      });

      if (res.success) {
        success(`User ${name} (@${username}) created successfully.`, 'Personnel Account Created');
        setIsCreateModalOpen(false);
        setUsername('');
        setName('');
        setEmail('');
        setPassword('');
        setCollege('');
        setCustomCollege('');
        loadUsers();
      }
    } catch (err: any) {
      error(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      const res = await userApi.update(user._id, { isActive: !user.isActive });
      if (res.success) {
        success(
          `Account for ${user.name} is now ${!user.isActive ? 'Active' : 'Disabled'}.`,
          'Status Changed'
        );
        loadUsers();
      }
    } catch (err: any) {
      error(err.message || 'Failed to update user status');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToReset) return;
    if (newPassword.length < 6) {
      error('New password must be at least 6 characters long', 'Validation Error');
      return;
    }

    setIsResetting(true);
    try {
      const res = await userApi.resetPassword(userToReset._id, newPassword);
      if (res.success) {
        success(`Password for ${userToReset.name} has been reset.`, 'Password Reset Complete');
        setUserToReset(null);
        setNewPassword('');
      }
    } catch (err: any) {
      error(err.message || 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  };

  const canManageUser = (target: User) => {
    if (target.userId === currentUser?.userId) return false;
    if (isMasterAdmin) return true;
    // Members can only manage College Executives and Distributive Agents
    return target.role === 'COLLEGE_MEMBER' || target.role === 'CAMPUS_EXECUTIVE';
  };

  const isAuthorized =
    isMasterAdmin || currentUser?.role === 'MEMBER' || currentUser?.role === 'STAFF';

  if (!isAuthorized) {
    return (
      <div className="p-8 bg-white rounded-xl border border-slate-200 text-center space-y-3">
        <Lock className="w-10 h-10 text-slate-400 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          You do not have permission to view team accounts or manage campus personnel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Team & Campus Personnel</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isMasterAdmin
              ? 'Manage user accounts, RBAC permissions, and password credentials.'
              : 'Create and manage College Executives (Ambassadors) and Campus Distributive Agents.'}
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{isMasterAdmin ? 'Add Team Member' : 'Add College Executive / Agent'}</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 font-mono">Permanent User ID</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading team directory...
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{u.name}</div>
                      <div className="text-slate-400 text-[11px]">
                        @{u.username} • {u.email}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[11px] ${
                          u.role === 'MASTER_ADMIN'
                            ? 'bg-amber-100 text-amber-900'
                            : u.role === 'CAMPUS_EXECUTIVE'
                            ? 'bg-emerald-100 text-emerald-900'
                            : u.role === 'COLLEGE_MEMBER'
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {u.role === 'MASTER_ADMIN' && <ShieldCheck className="w-3 h-3 text-amber-600" />}
                        {u.role === 'CAMPUS_EXECUTIVE' && <UserCheck className="w-3 h-3 text-emerald-600" />}
                        {u.role === 'MASTER_ADMIN'
                          ? 'Master Admin'
                          : u.role === 'CAMPUS_EXECUTIVE'
                          ? `Campus Distributive Agent${u.college ? ` (${u.college})` : ''}`
                          : u.role === 'COLLEGE_MEMBER'
                          ? `College Member (${u.college})`
                          : 'Member'}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-600">{u.userId}</td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                          u.isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {u.isActive ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-500 font-mono">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never logged in'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canManageUser(u) ? (
                          <>
                            <button
                              onClick={() => {
                                setUserToReset(u);
                                setNewPassword('');
                              }}
                              className="px-2.5 py-1 rounded text-slate-600 hover:bg-slate-100 font-medium text-[11px] flex items-center gap-1 transition"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                              <span>Reset Password</span>
                            </button>

                            <button
                              onClick={() => handleToggleActive(u)}
                              className={`px-2.5 py-1 rounded font-medium text-[11px] transition ${
                                u.isActive
                                  ? 'text-rose-600 hover:bg-rose-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {u.isActive ? 'Disable' : 'Enable'}
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 rounded bg-slate-50 border border-slate-150">
                            {u.userId === currentUser?.userId ? 'Current User' : 'Protected'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Team Member"
        subtitle="Create staff account with role-based permissions."
        maxWidth="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Username <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                placeholder="e.g. rahul"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rahul@upvolt.in"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Initial Password <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters (hashed with bcrypt)"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
            <select
              value={role}
              onChange={(e: any) => setRole(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
            >
              {!isMasterAdmin ? (
                <>
                  <option value="COLLEGE_MEMBER">College Executive / Campus Ambassador (College Node Lead)</option>
                  <option value="CAMPUS_EXECUTIVE">Campus Distributive Agent (On-ground student kit handovers)</option>
                </>
              ) : (
                <>
                  <option value="MEMBER">Member (Operational access; inventory & orders)</option>
                  <option value="COLLEGE_MEMBER">College Executive / Campus Ambassador (College Node Lead)</option>
                  <option value="CAMPUS_EXECUTIVE">Campus Distributive Agent (On-ground student kit handovers)</option>
                  <option value="MASTER_ADMIN">Master Admin (Complete permissions & soft-delete)</option>
                </>
              )}
            </select>
          </div>

          {(role === 'COLLEGE_MEMBER' || role === 'CAMPUS_EXECUTIVE') && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Target College / Campus</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-amber-700 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  Required for {role === 'COLLEGE_MEMBER' ? 'College Executive' : 'Distributive Agent'}
                </span>
              </div>
              <select
                required
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="">-- Select Target College --</option>
                <option value="KIET Group of Institutions">KIET Group of Institutions</option>
                <option value="ABES Engineering College">ABES Engineering College</option>
                <option value="AKGEC Ghaziabad">AKGEC Ghaziabad</option>
                <option value="Galgotias University">Galgotias University</option>
                <option value="GL Bajaj Institute">GL Bajaj Institute</option>
                {collegesList
                  .filter(
                    (c) =>
                      ![
                        'KIET Group of Institutions',
                        'ABES Engineering College',
                        'AKGEC Ghaziabad',
                        'Galgotias University',
                        'GL Bajaj Institute',
                      ].includes(c)
                  )
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                <option value="__CUSTOM__">+ Other / Enter Custom College...</option>
              </select>

              {college === '__CUSTOM__' && (
                <input
                  type="text"
                  required
                  value={customCollege}
                  onChange={(e) => setCustomCollege(e.target.value)}
                  placeholder="Enter target college / university name"
                  className="mt-2 w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              )}
              <p className="text-[10px] text-slate-400 mt-1">
                This {role === 'COLLEGE_MEMBER' ? 'College Executive' : 'Campus Distributive Agent'} will be mapped strictly to this campus.
              </p>
            </div>
          )}

          {role === 'MASTER_ADMIN' && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
              ⚠️ Warning: You are creating a user with MASTER ADMIN privileges. They will have unrestricted access to all central inventory, financial data, and user management.
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      {userToReset && (
        <Modal
          isOpen={!!userToReset}
          onClose={() => setUserToReset(null)}
          title={`Reset Password for ${userToReset.name}`}
          subtitle={`Permanent User ID: ${userToReset.userId}`}
          maxWidth="sm"
        >
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new secure password"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setUserToReset(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isResetting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm disabled:opacity-50"
              >
                {isResetting ? 'Resetting...' : 'Save New Password'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
