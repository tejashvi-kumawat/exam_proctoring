# PythonAnywhere Deployment Guide

## 🚀 Deploying Django Backend on PythonAnywhere

**Frontend URL:** https://exam-proctoring.vercel.app/
**Backend URL:** https://exam0proctoring.pythonanywhere.com/
**Username:** exam0proctoring

---

## Step 1: Sign Up / Login to PythonAnywhere

1. Go to https://www.pythonanywhere.com/
2. Login with username: `exam0proctoring`
3. You'll get a free account (good for small projects)

---

## Step 2: Upload Your Code

### Option A: Using Git (Recommended)

1. **Open a Bash console** in PythonAnywhere
2. **Clone your repository:**
```bash
git clone https://github.com/tejashvi-kumawat/exam_proctoring.git
cd exam_proctoring
```

### Option B: Upload Manually

1. Go to **Files** tab
2. Upload your `Backend` folder
3. Extract if needed

---

## Step 3: Create Virtual Environment

In the PythonAnywhere Bash console:

```bash
# Navigate to your project
cd exam_proctoring/Backend/exam_proctoring

# Create virtual environment
mkvirtualenv --python=/usr/bin/python3.10 exam-env

# Activate it (it should auto-activate after creation)
workon exam-env

# Install dependencies
pip install -r requirements.txt
```

---

## Step 4: Set Up Database

```bash
# Make sure you're in the right directory
cd ~/exam_proctoring/Backend/exam_proctoring

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser
# Follow prompts to create admin user
```

---

## Step 5: Collect Static Files

```bash
python manage.py collectstatic --noinput
```

---

## Step 6: Configure Web App

1. Go to **Web** tab in PythonAnywhere
2. Click **Add a new web app**
3. Choose **Manual configuration** (not Django wizard)
4. Select **Python 3.10**

### 6.1 Configure Source Code

In the Web tab, set:
- **Source code:** `/home/exam0proctoring/exam_proctoring/Backend/exam_proctoring`
- **Working directory:** `/home/exam0proctoring/exam_proctoring/Backend/exam_proctoring`

### 6.2 Configure Virtual Environment

- **Virtualenv:** `/home/exam0proctoring/.virtualenvs/exam-env`

### 6.3 Configure WSGI File

Click on the **WSGI configuration file** link and replace ALL content with:

```python
import os
import sys

# Add your project directory to the sys.path
project_home = '/home/exam0proctoring/exam_proctoring/Backend/exam_proctoring'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Set environment variable for Django settings
os.environ['DJANGO_SETTINGS_MODULE'] = 'exam_proctoring.settings'

# Activate virtual environment
activate_this = '/home/exam0proctoring/.virtualenvs/exam-env/bin/activate_this.py'
with open(activate_this) as file_:
    exec(file_.read(), dict(__file__=activate_this))

# Import Django WSGI application
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```

Save the file.

### 6.4 Configure Static Files

In the **Static files** section, add:

| URL | Directory |
|-----|-----------|
| `/static/` | `/home/exam0proctoring/exam_proctoring/Backend/exam_proctoring/static` |
| `/media/` | `/home/exam0proctoring/exam_proctoring/Backend/exam_proctoring/media` |

---

## Step 7: Set Environment Variables (Optional)

If you're using `.env` file:

1. In Bash console, create `.env` file:
```bash
cd ~/exam_proctoring/Backend/exam_proctoring
nano .env
```

2. Add your environment variables:
```env
SECRET_KEY=your-secret-key-here
DEBUG=False
```

3. Save (Ctrl+X, Y, Enter)

---

## Step 8: Reload Web App

1. Go back to **Web** tab
2. Click the big green **Reload** button
3. Wait for it to reload

---

## Step 9: Test Your Backend

Visit: https://exam0proctoring.pythonanywhere.com/

You should see your API!

Test endpoints:
- https://exam0proctoring.pythonanywhere.com/api/auth/
- https://exam0proctoring.pythonanywhere.com/api/exam/
- https://exam0proctoring.pythonanywhere.com/admin/

---

## Step 10: Update Frontend API URL

Update your frontend to use the PythonAnywhere backend:

In `Frontend/exam_proctoring/src/services/api.js`:

```javascript
const API_BASE_URL = 'https://exam0proctoring.pythonanywhere.com/api';
```

Then rebuild and redeploy your Vercel frontend:

```bash
cd Frontend/exam_proctoring
npm run build
git add .
git commit -m "Update API URL for PythonAnywhere backend"
git push origin main
```

Vercel will automatically redeploy.

---

## Troubleshooting

### Issue: 502 Bad Gateway
**Solution:** Check error logs in PythonAnywhere Web tab → Error log

### Issue: Static files not loading
**Solution:** 
```bash
python manage.py collectstatic --noinput
```
Then reload web app

### Issue: Database errors
**Solution:**
```bash
python manage.py migrate
```

### Issue: Module not found
**Solution:**
```bash
workon exam-env
pip install -r requirements.txt
```

### Issue: CORS errors
**Solution:** Verify `settings.py` has correct CORS settings (already done!)

---

## Important Notes

### Free Tier Limitations:
- ⚠️ **No WebSocket support** on free tier (your proctoring features using channels won't work)
- ⚠️ App sleeps after inactivity
- ⚠️ Limited CPU time (100 seconds/day)
- ✅ Good for testing and demos

### For WebSocket Support:
You'll need a **paid PythonAnywhere account** ($5/month) to use:
- Django Channels
- WebSocket connections
- Real-time proctoring features

---

## Viewing Logs

### Error Logs:
Web tab → Error log (click to view)

### Server Logs:
Web tab → Server log (click to view)

### Access Logs:
Web tab → Access log (click to view)

---

## Updating Your Code

When you make changes:

```bash
# SSH into PythonAnywhere console
cd ~/exam_proctoring
git pull origin main
cd Backend/exam_proctoring

# Activate environment
workon exam-env

# Install any new dependencies
pip install -r requirements.txt

# Run migrations if needed
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

# Reload from Web tab or:
touch /var/www/exam0proctoring_pythonanywhere_com_wsgi.py
```

Then go to Web tab and click **Reload**.

---

## Security Checklist

Before going live:

✅ Set `DEBUG = False` in production
✅ Use strong `SECRET_KEY`
✅ Configure `ALLOWED_HOSTS` properly
✅ Set up proper CORS origins
✅ Create strong superuser password
✅ Review `CSRF_TRUSTED_ORIGINS`
✅ Set up HTTPS (PythonAnywhere provides this)

---

## Quick Reference

| Item | Value |
|------|-------|
| **Backend URL** | https://exam0proctoring.pythonanywhere.com |
| **Frontend URL** | https://exam-proctoring.vercel.app |
| **Admin Panel** | https://exam0proctoring.pythonanywhere.com/admin |
| **API Docs** | https://exam0proctoring.pythonanywhere.com/api |
| **Username** | exam0proctoring |
| **Project Path** | /home/exam0proctoring/exam_proctoring |
| **Venv Path** | /home/exam0proctoring/.virtualenvs/exam-env |

---

## Need Help?

- PythonAnywhere Forums: https://www.pythonanywhere.com/forums/
- PythonAnywhere Help: https://help.pythonanywhere.com/
- Django Docs: https://docs.djangoproject.com/

---

**Good Luck!** 🚀

Your backend will be live at: **https://exam0proctoring.pythonanywhere.com/**

