// Central media config. Replace any value with a real URL; empty string = styled placeholder.
export const assets = {
  trailer: { videoUrl: "", posterUrl: "", title: "FRIKHII Copilot trailer", description: "A short look at how FRIKHII turns a goal into a learning journey." },
  gallery: [
    { label: "Product brand photography", src: "", alt: "FRIKHII brand photography" },
    { label: "Student learning environment", src: "", alt: "A student learning" },
    { label: "AI learning experience", src: "", alt: "AI learning experience" },
    { label: "Product interface", src: "", alt: "Product interface" },
    { label: "Course roadmap preview", src: "", alt: "Course roadmap preview" },
    { label: "AI Tutor preview", src: "", alt: "AI Tutor preview" },
  ],
  interfaces: ["Dashboard", "Course roadmap", "Lesson workspace", "Assessment", "Learning analytics"].map((label) => ({ label, src: "", alt: label + " screenshot" })),
};
