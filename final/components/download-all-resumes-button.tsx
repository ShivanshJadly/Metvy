 // Client component for download all functionality
 "use client";

 import { Download } from "lucide-react";
 import { Button } from "@/components/ui/button";

 function DownloadAllButton({ resumes, candidateIds }: { resumes: any[]; candidateIds: string[] }) {
   const handleDownloadAll = async () => {
     for (let i = 0; i < resumes.length; i++) {
       const resume = resumes[i];
       const url = `https://storage.googleapis.com/${resume.gcsBucket}/${resume.gcsFilePath}`;
       const fileName = `${candidateIds[i]}.pdf`;

       const link = document.createElement("a");
       link.href = url;
       link.download = fileName;
       link.target = "_blank";
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);

       if (i < resumes.length - 1) {
         await new Promise((resolve) => setTimeout(resolve, 300));
       }
     }
   };

   return (
     <Button onClick={handleDownloadAll} className="bg-gray-900 text-white hover:bg-gray-800" size="sm">
       <Download className="mr-2 h-4 w-4" />
       Download All ({resumes.length})
     </Button>
   );
 }
