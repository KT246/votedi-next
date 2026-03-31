const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '../../votedi/src');
const TARGET_DIR = path.join(__dirname, '../src');

// Mapping of import replacements
const replacements = [
    // React Router to Next.js
    { from: /from 'react-router-dom'/g, to: "from 'next/navigation'" },
    { from: /useNavigate\(\)/g, to: "useRouter()" },
    { from: /useSearchParams\(\)/g, to: "useSearchParams()" },
    { from: /useLocation\(\)/g, to: "usePathname()" },
    { from: /<Navigate to=/g, to: "<Redirect to=" }, // Need to handle differently
    { from: /import { Navigate }/g, to: "import { redirect } from 'next/navigation'" },
    // Environment variables
    { from: /import\.meta\.env\.VITE_API_URL/g, to: "process.env.NEXT_PUBLIC_API_URL" },
    { from: /import\.meta\.env/g, to: "process.env.NEXT_PUBLIC_" },
    // Add "use client" directive
    { from: /^import /gm, to: (match) => `"use client";\n${match}` }, // Not perfect, need to add at top
];

function addUseClient(content) {
    if (content.includes('"use client"')) return content;
    // Add after any imports? Simpler: add at top
    return `"use client";\n\n${content}`;
}

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            // Only process .tsx, .ts, .jsx, .js files
            if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
                let content = fs.readFileSync(srcPath, 'utf8');
                
                // Apply replacements
                for (let rep of replacements) {
                    if (typeof rep.to === 'function') {
                        content = content.replace(rep.from, rep.to);
                    } else {
                        content = content.replace(rep.from, rep.to);
                    }
                }
                
                // Add "use client" for components and pages
                if (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx')) {
                    content = addUseClient(content);
                }
                
                fs.writeFileSync(destPath, content);
                console.log(`Copied and adapted: ${srcPath} -> ${destPath}`);
            } else {
                // Copy other files as is
                fs.copyFileSync(srcPath, destPath);
                console.log(`Copied: ${srcPath} -> ${destPath}`);
            }
        }
    }
}

// Copy specific directories
const dirsToCopy = [
    'components',
    'pages',
    'admin/components',
    'admin/pages',
    'api',
    'hooks',
    'store',
    'types',
    'i18n',
    'locales',
];

for (let dir of dirsToCopy) {
    const src = path.join(SOURCE_DIR, dir);
    const dest = path.join(TARGET_DIR, dir);
    if (fs.existsSync(src)) {
        copyDir(src, dest);
    } else {
        console.log(`Source directory not found: ${src}`);
    }
}

console.log('Migration script completed. Manual adjustments needed:');
console.log('1. Review each file for correct import paths');
console.log('2. Replace <Navigate> components with router.push() or redirect()');
console.log('3. Update component props if using React Router components');
console.log('4. Ensure "use client" directive is placed correctly');
console.log('5. Test each page after migration');