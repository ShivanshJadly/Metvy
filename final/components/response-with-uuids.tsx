// "use client";

import equal from "fast-deep-equal"; // Ensure you have this installed, or use a simple array comparison
import React, { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

type ResponseWithUuidsProps = ComponentProps<typeof Streamdown> & {
  validUuids?: string[] | null;
  selectedUuids: string[];
  onUuidClick: (uuid: string) => void;
  resumeData: any[];
};

// 1. Rename the main component to "ResponseWithUuidsBase"
const ResponseWithUuidsBase = ({
  className,
  validUuids,
  selectedUuids,
  onUuidClick,
  resumeData,
  children,
  ...props
}: ResponseWithUuidsProps) => {
  // This log will now only appear for messages that ACTUALLY contain UUIDs
  // and only when necessary.
  // console.log("ResponseWithUuids render");

  const components = {
    p: (componentProps: any) => (
      <p {...componentProps}>
        <ProcessChildren
          onUuidClick={onUuidClick}
          resumeData={resumeData}
          selectedUuids={selectedUuids}
          validUuids={validUuids}
        >
          {componentProps.children}
        </ProcessChildren>
      </p>
    ),
    td: (componentProps: any) => (
      <td {...componentProps} className="p-4">
        <ProcessChildren
          onUuidClick={onUuidClick}
          resumeData={resumeData}
          selectedUuids={selectedUuids}
          validUuids={validUuids}
        >
          {componentProps.children}
        </ProcessChildren>
      </td>
    ),
    li: (componentProps: any) => (
      <li {...componentProps}>
        <ProcessChildren
          onUuidClick={onUuidClick}
          resumeData={resumeData}
          selectedUuids={selectedUuids}
          validUuids={validUuids}
        >
          {componentProps.children}
        </ProcessChildren>
      </li>
    ),
    blockquote: (componentProps: any) => (
      <blockquote {...componentProps}>
        <ProcessChildren
          onUuidClick={onUuidClick}
          resumeData={resumeData}
          selectedUuids={selectedUuids}
          validUuids={validUuids}
        >
          {componentProps.children}
        </ProcessChildren>
      </blockquote>
    ),
  };

  return (
    <Streamdown
      className={cn(
        "[&_code]:wrap-break-word size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:whitespace-pre-wrap [&_pre]:max-w-full [&_pre]:overflow-x-auto",
        className
      )}
      components={components}
      {...props}
    >
      {children}
    </Streamdown>
  );
};

// 2. Export the Memoized version
export const ResponseWithUuids = memo(
  ResponseWithUuidsBase,
  (prevProps, nextProps) => {
    // A: If the text content (children) changed, we MUST re-render
    if (prevProps.children !== nextProps.children) {
      return false;
    }

    // B: If this specific message HAS NO valid UUIDs in it...
    const prevHasUuids =
      prevProps.validUuids && prevProps.validUuids.length > 0;
    const nextHasUuids =
      nextProps.validUuids && nextProps.validUuids.length > 0;

    if (!prevHasUuids && !nextHasUuids) {
      // ...then we don't care if 'selectedUuids' changed globally.
      // This component doesn't need to update visual state.
      return true; // return true means "Skip Re-render"
    }

    // C: If we DO have UUIDs, check if the selection actually changed.
    return equal(prevProps.selectedUuids, nextProps.selectedUuids);
  }
);

// --- Everything below this line stays exactly the same ---

function ProcessChildren({
  children,
  validUuids,
  selectedUuids,
  onUuidClick,
  resumeData,
}: {
  children: React.ReactNode;
  validUuids?: string[] | null;
  selectedUuids: string[];
  onUuidClick: (uuid: string) => void;
  resumeData: any[];
}) {
  if (!validUuids || validUuids.length === 0) {
    return <>{children}</>;
  }

  const config: UuidProcessingConfig = {
    validUuids,
    selectedUuids,
    onUuidClick,
    resumeData,
  };

  const processNode = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === "string") {
      return replaceUuidsInString(node, config);
    }

    if (Array.isArray(node)) {
      return node.map((child, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: no other option
        <React.Fragment key={index}>{processNode(child)}</React.Fragment>
      ));
    }

    if (React.isValidElement(node) && node.props.children) {
      return React.cloneElement(node, {
        ...node.props,
        children: processNode(node.props.children),
      } as any);
    }

    return node;
  };

  return <>{processNode(children)}</>;
}

type UuidProcessingConfig = {
  validUuids: string[];
  selectedUuids: string[];
  onUuidClick: (uuid: string) => void;
  resumeData: any[];
};

function replaceUuidsInString(
  text: string,
  config: UuidProcessingConfig
): React.ReactNode {
  const { validUuids, selectedUuids, onUuidClick } = config;

  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  const pattern = validUuids.map((uuid) => escapeRegExp(uuid)).join("|");
  const regex = new RegExp(`\\b(${pattern})\\b`, "gi");

  if (!regex.test(text)) {
    return text;
  }

  regex.lastIndex = 0;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) {
      return null;
    }

    const matchedUuid = validUuids.find(
      (uuid) => uuid.toLowerCase() === part.toLowerCase()
    );

    if (matchedUuid) {
      // NOTE: We do not need resumeData here since we aren't using URLs anymore
      const isSelected = selectedUuids.some(
        (u) => u.toLowerCase() === matchedUuid.toLowerCase()
      );

      return (
        <UuidComponent
          isSelected={isSelected}
          key={`uuid-${matchedUuid}`}
          onClick={() => onUuidClick(matchedUuid)}
          uuid={matchedUuid}
        />
      );
    }

    // biome-ignore lint/suspicious/noArrayIndexKey: no other option
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function UuidComponent({
  uuid,
  isSelected,
  onClick,
}: {
  uuid: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };

  return (
    <button
      className={`uuid-span inline-block cursor-pointer font-medium text-xs underline decoration-[1.5px] underline-offset-2 transition-all ease-in-out hover:text-blue-600 ${
        isSelected ? "font-semibold text-blue-800" : "text-blue-500"
      }`}
      onClick={handleClick}
      type="button"
    >
      {uuid}
    </button>
  );
}
