import { requireSession } from "@/server/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileView } from "@/features/profile/components/profile-view";

export const metadata = {
  title: "My Profile - Hotel Desk",
  description: "View and update your staff profile and security settings.",
};

export default async function ProfilePage() {
  const { actor } = await requireSession();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="My Profile"
        description="View and manage your account credentials and personal information."
      />

      <ProfileView user={actor} />
    </div>
  );
}

