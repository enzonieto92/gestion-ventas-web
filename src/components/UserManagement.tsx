import { useState, useEffect } from 'react';
import { Users, Plus, Edit2, X, Trash2 } from 'lucide-react';
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  type User,
  type CreateUserInput,
} from '../config/database';

interface UserManagementProps {
  currentUserId: number;
  onSessionUserUpdated?: (user: User) => void;
}

const emptyCreate: CreateUserInput = {
  username: '',
  password: '',
  email: '',
  full_name: '',
  role: 'user',
};

export function UserManagement({ currentUserId, onSessionUserUpdated }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    full_name: '',
    role: 'user' as 'admin' | 'user',
    is_active: true,
    password: '',
  });

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    const list = await fetchUsers();
    setUsers(list);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const { user, error: err } = await createUser({
      username: createForm.username,
      password: createForm.password,
      email: createForm.email || undefined,
      full_name: createForm.full_name || undefined,
      role: createForm.role,
    });
    if (err) {
      setError(err);
      return;
    }
    if (user) {
      setUsers((prev) => [...prev, user].sort((a, b) => a.username.localeCompare(b.username)));
      setCreateForm(emptyCreate);
      setMessage('Usuario creado correctamente.');
    }
  };

  const startEdit = (u: User) => {
    setEditingId(u.id);
    setEditForm({
      username: u.username,
      email: u.email ?? '',
      full_name: u.full_name ?? '',
      role: u.role === 'admin' ? 'admin' : 'user',
      is_active: u.is_active,
      password: '',
    });
    setMessage(null);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      username: '',
      email: '',
      full_name: '',
      role: 'user',
      is_active: true,
      password: '',
    });
  };

  const handleDelete = async (u: User) => {
    if (u.id === currentUserId) {
      setError('No puedes eliminar tu propia cuenta.');
      setMessage(null);
      return;
    }

    const adminCount = users.filter((x) => x.role === 'admin').length;
    if (u.role === 'admin' && adminCount <= 1) {
      setError('No puedes eliminar el único administrador del sistema.');
      setMessage(null);
      return;
    }

    if (
      !window.confirm(
        `¿Eliminar definitivamente la cuenta "${u.username}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    setMessage(null);
    setError(null);

    const { ok, error: err } = await deleteUser(u.id);
    if (!ok) {
      setError(err || 'No se pudo eliminar el usuario');
      return;
    }

    setUsers((prev) => prev.filter((x) => x.id !== u.id));
    if (editingId === u.id) {
      cancelEdit();
    }
    setMessage('Usuario eliminado.');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId === null) return;

    setMessage(null);
    setError(null);

    const isSelf = editingId === currentUserId;
    if (isSelf && !editForm.is_active) {
      setError('No puedes desactivar tu propia cuenta mientras tienes la sesión iniciada.');
      return;
    }

    const { user, error: err } = await updateUser(editingId, {
      username: editForm.username,
      email: editForm.email,
      full_name: editForm.full_name,
      role: editForm.role,
      is_active: editForm.is_active,
      password: editForm.password || undefined,
    });

    if (err) {
      setError(err);
      return;
    }

    if (user) {
      setUsers((prev) =>
        prev.map((x) => (x.id === user.id ? user : x)).sort((a, b) => a.username.localeCompare(b.username))
      );
      setMessage('Usuario actualizado.');
      if (isSelf && onSessionUserUpdated) {
        onSessionUserUpdated(user);
      }
      cancelEdit();
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
        <Users className="w-6 h-6" />
        <h2 className="text-xl sm:text-2xl font-semibold">Usuarios</h2>
      </div>

      {message && (
        <div className="bg-green-100 dark:bg-green-900/40 border border-green-400 dark:border-green-700 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-700 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <Plus className="w-5 h-5" />
          Nueva cuenta
        </h3>
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <input
            required
            placeholder="Usuario *"
            value={createForm.username}
            onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
          />
          <input
            required
            type="password"
            placeholder="Contraseña *"
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            autoComplete="new-password"
          />
          <input
            placeholder="Email (opcional)"
            type="email"
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
          />
          <input
            placeholder="Nombre completo (opcional)"
            value={createForm.full_name}
            onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
          />
          <select
            value={createForm.role}
            onChange={(e) =>
              setCreateForm({ ...createForm, role: e.target.value as 'admin' | 'user' })
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
          >
            <option value="user">Rol: usuario</option>
            <option value="admin">Rol: administrador</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Crear usuario
          </button>
        </form>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Las contraseñas nuevas se guardan tal cual en la base (modo demo). En producción conviene usar hash
          (bcrypt) y verificación en el servidor.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cuentas existentes</h3>
        </div>
        {loading ? (
          <p className="p-6 text-gray-600 dark:text-gray-400 text-sm">Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Usuario</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-gray-100 hidden md:table-cell">
                    Nombre
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-gray-100 hidden lg:table-cell">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Rol</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Activo</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                      {u.username}
                      {u.id === currentUserId && (
                        <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(tú)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 hidden md:table-cell">
                      {u.full_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 hidden lg:table-cell">
                      {u.email || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{u.role}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                      {u.is_active ? 'Sí' : 'No'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => startEdit(u)}
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <Edit2 className="w-4 h-4" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(u)}
                          disabled={u.id === currentUserId}
                          className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 hover:underline disabled:opacity-40 disabled:pointer-events-none disabled:no-underline"
                          title={u.id === currentUserId ? 'No puedes eliminar tu propia cuenta' : undefined}
                        >
                          <Trash2 className="w-4 h-4" />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 relative">
            <button
              type="button"
              onClick={cancelEdit}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Editar usuario</h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Usuario</label>
                <input
                  required
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Nueva contraseña (opcional)
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="Dejar vacío para no cambiar"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Nombre completo
                </label>
                <input
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rol</label>
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value as 'admin' | 'user' })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="edit-active"
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                  disabled={editingId === currentUserId}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <label htmlFor="edit-active" className="text-sm text-gray-700 dark:text-gray-300">
                  Cuenta activa
                  {editingId === currentUserId && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">(no puedes desactivarte aquí)</span>
                  )}
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 rounded-lg text-sm"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
