"use client";

import { Eye } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type StudentDetailsProps = {
  id: string;
  onDelete?: () => Promise<void>;
};

export function StudentDetailsDialog({ id, onDelete }: StudentDetailsProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [student, setStudent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStudentDetails = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/upload/api/students/${id}`);
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
      const data = await response.json();
      setStudent(data);
    } catch (error) {
      console.error("Failed to fetch student:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure? This will delete the student and all associated data."
      )
    ) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await fetch(`/upload/api/students/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
      onDelete?.();
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog onOpenChange={(open) => open && fetchStudentDetails()}>
      <DialogTrigger asChild>
        <Button className="cursor-pointer" size="icon" variant="outline">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Student Details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-96 items-center justify-center">
            <p>Loading...</p>
          </div>
        ) : student ? (
          <Tabs className="w-full" defaultValue="personal">
            <TabsList>
              <TabsTrigger value="personal">Personal Info</TabsTrigger>
              <TabsTrigger value="education">Education</TabsTrigger>
              <TabsTrigger value="experience">Experience</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
            </TabsList>

            <TabsContent className="space-y-4" value="personal">
              <div className="rounded-lg border p-4">
                <h3 className="mb-4 font-medium">Personal Information</h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-muted-foreground text-sm">Full Name</dt>
                    <dd>
                      {student.firstName} {student.lastName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">Email</dt>
                    <dd>{student.email}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">Phone</dt>
                    <dd>{student.phoneNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">
                      Years of Experience
                    </dt>
                    <dd>{student.totalYearsExperience} years</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="mb-4 font-medium">Skills & Expertise</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-muted-foreground text-sm">Skills</h4>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {student.skills?.map((skill: string) => (
                        <span
                          className="rounded-full bg-primary/10 px-2 py-1 text-xs"
                          key={skill}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-muted-foreground text-sm">
                      Key Domains
                    </h4>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {student.keyDomains?.map((domain: string) => (
                        <span
                          className="rounded-full bg-primary/10 px-2 py-1 text-xs"
                          key={domain}
                        >
                          {domain}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="education">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Level</TableHead>
                      <TableHead>Institution</TableHead>
                      <TableHead>Degree</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.education?.map((edu: any) => (
                      <TableRow key={edu.id}>
                        <TableCell>{edu.level}</TableCell>
                        <TableCell>{edu.institutionName}</TableCell>
                        <TableCell>{edu.degreeOrCertificate}</TableCell>
                        <TableCell>{edu.yearOfPassing}</TableCell>
                        <TableCell>{edu.score}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="experience">
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 font-medium">Work Experience</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Company</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Domain</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {student.jobs?.map((job: any) => (
                          <TableRow key={job.id}>
                            <TableCell>{job.companyName}</TableCell>
                            <TableCell>{job.roleTitle}</TableCell>
                            <TableCell>
                              {job.startDate} - {job.endDate || "Present"}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {job.domainTags?.map((tag: string) => (
                                  <span
                                    className="rounded-full bg-primary/10 px-2 py-1 text-xs"
                                    key={tag}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div>
                    <h3 className="mb-2 font-medium">Internships</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Company</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Duration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {student.internships?.map((internship: any) => (
                          <TableRow key={internship.id}>
                            <TableCell>{internship.companyName}</TableCell>
                            <TableCell>{internship.roleTitle}</TableCell>
                            <TableCell>
                              {internship.startDate} -{" "}
                              {internship.endDate || "Present"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="projects">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Technologies</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.projects?.map((project: any) => (
                      <TableRow key={project.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{project.projectName}</p>
                            <p className="text-muted-foreground text-sm">
                              {project.projectDescription}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{project.roleInProject}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {project.technologiesUsed?.map((tech: string) => (
                              <span
                                className="rounded-full bg-primary/10 px-2 py-1 text-xs"
                                key={tech}
                              >
                                {tech}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{project.durationMonths} months</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex h-96 items-center justify-center">
            <p>No student data found</p>
          </div>
        )}

        <div className="mt-4 flex justify-end space-x-2">
          <Button
            disabled={isDeleting}
            onClick={handleDelete}
            variant="destructive"
          >
            {isDeleting ? "Deleting..." : "Delete Student"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
