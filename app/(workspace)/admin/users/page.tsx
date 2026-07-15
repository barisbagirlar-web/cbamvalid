import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { fetchAllUsers } from "../actions";
import Link from "next/link";
import { ShieldCheck, User } from "lucide-react";

export default async function AdminUsersPage() {
  await requireSuperAdmin();
  
  const users = await fetchAllUsers();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">User Management</h1>
          <p className="text-muted text-sm mt-1">Manage users, view their details, and administer entitlements.</p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-surface border-b border-border font-medium">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">UID</th>
                <th className="py-3 px-4">System Role</th>
                <th className="py-3 px-4 text-right">Available Credits</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((profile) => (
                <tr key={profile.id} className="hover:bg-border/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center text-muted">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{profile.email}</div>
                        {profile.displayName && <div className="text-xs text-muted">{profile.displayName}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-muted">{profile.id}</td>
                  <td className="py-3 px-4">
                    {profile.role === "admin" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
                        <ShieldCheck className="w-3 h-3" /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-surface border border-border text-muted">
                        User
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                    {profile.credits}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link 
                      href={`/admin/users/${profile.id}`} 
                      className="text-xs font-medium text-accent hover:text-accent-hover underline underline-offset-2"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
              
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
