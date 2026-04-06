# IT Helpdesk - Professional Support System

A modern, full-featured IT helpdesk system built with React, TypeScript, and Tailwind CSS. Features role-based dashboards, ticket management, and AI chatbot integration for efficient support operations.

## 🌟 Features

### Authentication & Authorization
- **Role-based access control** (Employee/Manager)
- JWT-based authentication with localStorage
- Protected routes and conditional UI rendering
- Secure signup (employees) and login (both roles)

### Dashboard Systems
- **Employee Dashboard**: Personal ticket overview and quick actions
- **Manager Dashboard**: Team-wide analytics and ticket management
- Real-time statistics and performance metrics
- Professional, responsive design with gradients

### Ticket Management
- **Create Tickets**: Rich form with categories, priorities, and descriptions
- **My Tickets**: Personal ticket tracking with filters and search
- **All Tickets** (Manager): Complete team ticket management with status updates
- Status workflow: Open → In Progress → Resolved → Closed
- Priority levels: Low, Medium, High, Urgent
- Category-based organization

### AI Chatbot Support
- **Intelligent Intent Detection**: Automatically categorizes user queries
- **Auto-Resolution**: Password reset requests handled automatically
- **Ticket Creation**: Generates tickets for complex issues
- **Interactive Interface**: Modern chat UI with quick response buttons
- **Context-Aware Responses**: Tailored solutions based on issue type

### Professional UI/UX
- **Modern Design System**: Professional blue/purple gradient theme
- **Responsive Layout**: Mobile-first design with sidebar navigation  
- **Beautiful Components**: Custom shadcn/ui components with variants
- **Smooth Animations**: Polished interactions and transitions
- **Status Indicators**: Color-coded priorities and status badges

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Modern web browser

### Installation & Setup

1. **Clone and Install**
   ```bash
   git clone <your-repo-url>
   cd it-helpdesk
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Open Application**
   - Navigate to `http://localhost:8080`
   - The app will automatically redirect to `/dashboard`

### Demo Accounts

**Manager Account:**
- Email: `manager@company.com`
- Password: `anything`
- Access: Full dashboard, all tickets, team management

**Employee Account:**
- Email: `employee@company.com` 
- Password: `anything`
- Access: Personal dashboard, own tickets, chatbot

*Note: Any password works in demo mode*

## 🏗️ Architecture & Technology Stack

### Frontend Stack
- **React 18** with TypeScript for type safety
- **Vite** for fast development and building
- **Tailwind CSS** for styling with custom design system
- **shadcn/ui** for professional UI components
- **React Router** for navigation and protected routes
- **Lucide React** for consistent iconography

### State Management
- **localStorage** for authentication tokens and user data
- **React useState/useEffect** for component state
- **TanStack Query** ready for API integration

### Design System
- **Professional color palette** with HSL semantic tokens
- **Gradient system** for modern visual appeal  
- **Responsive breakpoints** with mobile-first approach
- **Status color coding** for intuitive information hierarchy
- **Dark mode support** (automatic system preference)

## 📁 Project Structure

```
src/
├── components/
│   ├── auth/                 # Authentication pages
│   │   ├── LoginPage.tsx
│   │   └── SignupPage.tsx
│   ├── dashboard/            # Dashboard components
│   │   ├── DashboardPage.tsx
│   │   ├── EmployeeDashboard.tsx
│   │   └── ManagerDashboard.tsx
│   ├── layout/              # Layout components
│   │   ├── DashboardLayout.tsx
│   │   └── AppSidebar.tsx
│   ├── tickets/             # Ticket management
│   │   ├── MyTicketsPage.tsx
│   │   ├── AllTicketsPage.tsx
│   │   ├── NewTicketPage.tsx
│   │   └── ChatbotPage.tsx
│   └── ui/                  # Reusable UI components
├── hooks/                   # Custom React hooks
├── lib/                     # Utility functions
└── pages/                   # Route pages
```

## 🎨 Design System

### Color Palette
- **Primary**: Professional purple (#8B5CF6) with glow variants
- **Status Colors**: 
  - Open: Blue (#3B82F6)
  - In Progress: Amber (#F59E0B)  
  - Resolved: Green (#059669)
  - Closed: Gray (#6B7280)
- **Semantic Tokens**: All colors use HSL CSS variables for consistency

### Component Variants
- **Buttons**: Primary gradient, outline, ghost variants
- **Cards**: Gradient backgrounds with subtle shadows
- **Badges**: Status-specific color coding
- **Tables**: Responsive with hover states

## 🔄 Extending to Full-Stack

This frontend is designed to integrate seamlessly with **Supabase** for backend functionality:

### Recommended Supabase Setup

1. **Authentication**
   ```sql
   -- Enable RLS and create profiles table
   CREATE TABLE profiles (
     id UUID REFERENCES auth.users ON DELETE CASCADE,
     email TEXT,
     role TEXT CHECK (role IN ('employee', 'manager')),
     name TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. **Tickets Table**
   ```sql
   CREATE TABLE tickets (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     title TEXT NOT NULL,
     description TEXT NOT NULL,
     category TEXT NOT NULL,
     status TEXT CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')),
     priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
     assignee_id UUID REFERENCES profiles(id),
     created_by UUID REFERENCES profiles(id),
     team TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

3. **Row Level Security**
   ```sql
   -- Employees can only see their own tickets
   CREATE POLICY "Users can view own tickets" ON tickets
     FOR SELECT USING (auth.uid() = created_by);

   -- Managers can see all tickets
   CREATE POLICY "Managers can view all tickets" ON tickets
     FOR SELECT USING (
       EXISTS (
         SELECT 1 FROM profiles 
         WHERE profiles.id = auth.uid() 
         AND profiles.role = 'manager'
       )
     );
   ```

### Environment Variables (for Supabase integration)
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🤖 Chatbot Implementation

The chatbot uses rule-based intent detection and can be enhanced with:

1. **OpenAI Integration** for natural language processing
2. **Knowledge Base** integration for common solutions
3. **Ticket Auto-Assignment** based on category and team availability
4. **Escalation Rules** for urgent issues

## 📱 Mobile Responsiveness

- **Responsive sidebar** that collapses on mobile devices
- **Touch-friendly** button sizes and spacing
- **Mobile-optimized** table layouts with horizontal scrolling
- **Adaptive typography** scaling across devices

## 🔧 Development Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production  
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## 🎯 Future Enhancements

### Phase 1 - Backend Integration
- [ ] Connect to Supabase for real data persistence
- [ ] Implement real-time ticket updates
- [ ] Add file attachments to tickets
- [ ] Email notifications for ticket updates

### Phase 2 - Advanced Features  
- [ ] Advanced search and filtering
- [ ] Ticket templates for common issues
- [ ] Time tracking and SLA management
- [ ] Analytics and reporting dashboard

### Phase 3 - AI Enhancement
- [ ] OpenAI-powered chatbot responses
- [ ] Automated ticket categorization
- [ ] Predictive issue resolution
- [ ] Smart ticket routing

## 📄 License

This project is built with modern web technologies and can be adapted for commercial use.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Built with ❤️ using React, TypeScript, and Tailwind CSS**