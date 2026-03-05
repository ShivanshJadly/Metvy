// app/admin/add-user-dialog.tsx
"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUser } from "./actions";

export function AddUserDialog() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"user" | "admin">("user");

  const handleSubmit = async (formData: FormData) => {
    try {
      // Add role to form data
      formData.append("role", role);

      await createUser(formData);
      toast({ type: "success", description: "User created successfully!" });
      setOpen(false);
      setRole("user"); // Reset

      // Refresh the page to update the users list
      window.location.reload();
    } catch (error) {
      toast({ type: "error", description: "Failed to create user!" });
      console.error(`Error creating user ${error}`);
    }
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account with email and password.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              autoComplete="name"
              id="name"
              name="name"
              placeholder="John Doe"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              autoComplete="email"
              id="email"
              name="email"
              placeholder="john@example.com"
              required
              type="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              autoComplete="new-password"
              id="password"
              minLength={8}
              name="password"
              placeholder="••••••••"
              required
              type="password"
            />
            <p className="text-muted-foreground text-xs">
              Minimum 8 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number (Optional)</Label>
            <Input
              autoComplete="tel"
              id="phone"
              name="phone"
              placeholder="+1 (555) 000-0000"
              type="tel"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select onValueChange={(value: any) => setRole(value)} value={role}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {role === "admin" && "Full access to all features"}
              {role === "user" && "Standard user access"}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <SubmitButton>Create User</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
