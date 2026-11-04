"use client";

import { useRouter } from "next/navigation";
import { LiveClock } from "./live-clock";
import { MenuIcon, LogoutIcon, RoomIcon, UserIcon } from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Role } from "@/lib/constants";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

interface TopbarProps {
  onMobileMenuOpen?: () => void;
  user?: {
    name: string;
    email: string;
    role: Role;
  };
}

export function Topbar({
  onMobileMenuOpen,
  user = {
    name: "Front Desk Staff",
    email: "staff@hotelpaul.in",
    role: "OWNER",
  },
}: TopbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      toast.success("Signed out successfully");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Failed to sign out");
    }
  };

  return (
    <header className="h-16 border-b border-border bg-card px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30 shadow-xs">
      {/* Left: Mobile hamburger & title */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <Button
          variant="outline"
          size="icon"
          className="md:hidden size-8 sm:size-9"
          onClick={onMobileMenuOpen}
          aria-label="Open mobile menu"
        >
          <MenuIcon className="size-4 sm:size-5" aria-hidden="true" />
        </Button>

        <div className="flex items-center gap-1.5 sm:gap-2 md:hidden">
          <div className="size-7 sm:size-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <RoomIcon className="size-3.5 sm:size-4" aria-hidden="true" />
          </div>
          <span className="font-semibold text-xs sm:text-sm truncate">Hotel Desk</span>
        </div>
      </div>

      {/* Right: Live Clock & User Menu */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <LiveClock />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2 hover:bg-muted"
                aria-label="Staff account menu"
              >
                <div className="size-7 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center border border-primary/20 shrink-0">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col items-start text-left">
                  <span className="text-xs font-semibold leading-none">
                    {user.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    {user.role}
                  </span>
                </div>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-1">
                <span className="font-semibold text-sm">{user.name}</span>
                <span className="text-xs text-muted-foreground font-normal truncate">
                  {user.email}
                </span>
                <div className="pt-1">
                  <Badge
                    variant={user.role === "OWNER" ? "default" : "secondary"}
                  >
                    {user.role}
                  </Badge>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => router.push("/profile")}
                className="cursor-pointer"
              >
                <UserIcon className="size-4 mr-2" aria-hidden="true" />
                <span>My Profile</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
            >
              <LogoutIcon className="size-4 mr-2" aria-hidden="true" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
