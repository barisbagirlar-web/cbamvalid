"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { adminSetUserTokens, listAllUsers, listAllTransactions } from "@/lib/functions/client";
import { firebaseAuth } from "@/lib/firebase/client";
import { ArrowLeft, RefreshCw } from "lucide-react";



interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  credits: number;
  role: "user" | "admin";
}

interface ReportLog {
  id: string;
  userId: string;
  cnCode: string;
  totalEmissions: number;
  status: string;
}

export default function AdminClient() {
  const { user, loading: authLoading, signOutUser } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<ReportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editTokensValue, setEditTokensValue] = useState<number>(0);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      if (!authLoading) {
        Promise.resolve().then(() => {
          setRoleLoading(false);
        });
      }
      return;
    }

    if (user.uid) {
      // We don't need docSnap anymore, we can just rely on claims
      const claims = (user as any).reloadUserInfo?.customAttributes;
      let parsedClaims = {};
      try {
        if (claims) parsedClaims = JSON.parse(claims);
      } catch(e) {}
      
      const userIsAdmin = (parsedClaims as any)?.admin || (parsedClaims as any)?.ownerAdmin;
      setRole(userIsAdmin ? "admin" : "user");
      setRoleLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (role && role !== "admin") {
      router.push("/cbam");
      return;
    }

    if (user && role === "admin") {
      fetchAdminData();
    }
  }, [user, router, role]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [usersData, txData] = await Promise.all([
        listAllUsers(),
        listAllTransactions()
      ]);
      setUsers(usersData || []);
      setReports(txData || []);
    } catch (err) {
      console.error("Admin fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (userProfile: UserProfile) => {
    setEditingUserId(userProfile.id);
    setEditTokensValue(userProfile.credits);
    setActionError("");
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setActionError("");
  };

  const handleSaveTokens = async (userId: string) => {
    setUpdatingUserId(userId);
    setActionError("");

    try {
      await adminSetUserTokens(userId, editTokensValue);
      setEditingUserId(null);
      await fetchAdminData();
    } catch (error) {
      const err = error as Error;
      console.error(err);
      setActionError(err.message || "An error occurred");
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (authLoading || roleLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kil-base text-kil-text font-mono text-sm">
        Verifying authorization state...
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className="p-8 text-kil-accent font-bold text-center mt-20 font-serif text-lg">
        Forbidden: You do not have administrator permissions to access this page.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-8">
      {/* Back Link to Dashboard */}
      <Link href="/cbam" className="text-xs font-semibold text-kil-text/60 hover:text-kil-text transition-colors flex items-center gap-2 cursor-pointer">
        <ArrowLeft className="h-4 w-4" /> Return to Dashboard
      </Link>

      {/* Page Title */}
      <div className="flex justify-between items-end border-b border-kil-text/15 pb-6 mb-8">
        <div>
          <h1 className="font-serif text-3xl font-black mb-2 text-kil-text">Super Admin Control Panel</h1>
          <p className="text-kil-text/60 font-mono text-sm">Administrative metrics and commercial transaction ledger registry.</p>
        </div>
        <button 
          onClick={fetchAdminData}
          className="text-xs font-semibold text-kil-text/60 hover:text-kil-text flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="p-6 border border-kil-text/10 rounded-sm bg-kil-surface shadow-sm">
          <p className="text-xs font-mono uppercase text-kil-text/60 mb-2">Total Registered Users</p>
          <p className="text-3xl font-bold font-mono text-kil-text">{users.length}</p>
        </div>
        <div className="p-6 border border-kil-text/10 rounded-sm bg-kil-surface shadow-sm">
          <p className="text-xs font-mono uppercase text-kil-text/60 mb-2">Sealed Reports Generated</p>
          <p className="text-3xl font-bold font-mono text-kil-text">{reports.length}</p>
        </div>
        <div className="p-6 border border-kil-accent/20 rounded-sm bg-kil-accent/5 shadow-sm">
          <p className="text-xs font-mono uppercase text-kil-accent mb-2">Monthly Gross Revenue</p>
          <p className="text-3xl font-bold font-mono text-kil-accent">${(reports.length * 150).toFixed(2)}</p>
        </div>
        <div className="p-6 border border-kil-text/10 rounded-sm bg-kil-surface shadow-sm">
          <p className="text-xs font-mono uppercase text-kil-text/60 mb-2">Total Issued Credits</p>
          <p className="text-3xl font-bold font-mono text-kil-text">
            {users.reduce((sum, u) => sum + u.credits, 0)}
          </p>
        </div>
      </div>

      {/* USER MANAGEMENT SECTION */}
      <div className="bg-kil-surface border border-kil-text/15 rounded-sm p-8 shadow-sm">
        <h3 className="font-serif text-xl text-kil-text mb-6">User Accounts & Entitlements Manager</h3>

        {actionError && (
          <div className="p-3 bg-kil-accent/10 border border-kil-accent/20 rounded-sm text-kil-accent text-xs font-mono text-center mb-6">
            {actionError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm font-mono text-kil-text">
            <thead className="bg-kil-base text-kil-text/80 font-bold border-b border-kil-text/15">
              <tr>
                <th className="py-3 px-4 rounded-l-sm">User ID</th>
                <th className="py-3 px-4">Email Address</th>
                <th className="py-3 px-4">System Role</th>
                <th className="py-3 px-4">Credits</th>
                <th className="py-3 px-4 rounded-r-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kil-text/10">
              {users.map((profile) => (
                <tr key={profile.id} className="hover:bg-kil-base/30 transition-colors">
                  <td className="py-3.5 px-4 text-xs text-kil-accent">{profile.id}</td>
                  <td className="py-3.5 px-4">{profile.email}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      profile.role === "admin" 
                        ? "bg-kil-accent/10 text-kil-accent border border-kil-accent/20" 
                        : "bg-kil-base text-kil-text/60 border border-kil-text/10"
                    }`}>
                      {profile.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold">
                    {editingUserId === profile.id ? (
                      <input
                        type="number"
                        value={editTokensValue}
                        onChange={(e) => setEditTokensValue(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-20 px-2 py-1 bg-transparent border-b border-kil-text/30 focus:outline-none focus:border-kil-accent font-mono text-sm"
                      />
                    ) : (
                      profile.credits
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {editingUserId === profile.id ? (
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleSaveTokens(profile.id)}
                          disabled={updatingUserId === profile.id}
                          className="text-xs font-semibold text-accent hover:text-accent-hover cursor-pointer"
                        >
                          {updatingUserId === profile.id ? "Updating..." : "Save"}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-xs font-semibold text-kil-text/50 hover:text-kil-text cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(profile)}
                        className="text-xs font-semibold text-accent hover:text-accent-hover border-b border-transparent hover:border-accent pb-0.5 cursor-pointer"
                      >
                        Adjust Credits
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
