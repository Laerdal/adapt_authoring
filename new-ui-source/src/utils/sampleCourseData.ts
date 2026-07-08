import type { Course } from '@/types/course';

export const sampleCourse: Course = {
  id: '211150',
  title: 'Sample Course',
  description: 'A sample course demonstrating the structure map',
  createdAt: new Date(),
  updatedAt: new Date(),
  status: 'Draft',
  menuPage: {
    logoUrl: null,
    title: 'Menu',
    subtitle: '',
    body: '',
    menuStyle: 'Box Menu',
    menuLockType: '',
    textAlign: 'center',
    bgType: 'Color',
    bgColor: '#1e3a5f',
  },
  pages: [
    // pages[0] → Course card (top node)
    {
      id: 'intro-01',
      title: 'Introduction',
      description: 'Course introduction',
      articles: [],
      subPages: [],
      order: 0,
    },
    // pages[1..] → Modules; their subPages → Topics
    {
      id: 'module-01',
      title: 'Module 1 Introduction',
      description: '',
      articles: [],
      subPages: [
        { id: 'topic-1-1', title: 'Topic 1.1 Basics' },
      ],
      order: 1,
    },
    {
      id: 'module-02',
      title: 'Module 2 Deep Dive',
      description: '',
      articles: [],
      subPages: [
        { id: 'topic-2-1', title: 'Topic 2.1 Details' },
      ],
      order: 2,
    },
  ],
};
