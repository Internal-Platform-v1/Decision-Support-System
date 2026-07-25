(() => {
    const root = document.getElementById("enterpriseSpotlight");
    if (!root) return;

    // ------------------------------------------------------------------
    // SAMPLE DATA
    // Firestore will replace this later.
    // ------------------------------------------------------------------

    const bulletins = [
        {
            id: 1,
            type: "critical",
            icon: "fa-solid fa-triangle-exclamation",
            badge: "CRITICAL",
            title: "Scheduled Maintenance",
            summary: "Servers will be unavailable tonight while infrastructure upgrades are completed.",
            date: "Tonight • 11:00 PM - 1:00 AM",
            timeAgo: "5 minutes ago",
            button: "View Details"
        },
        {
            id: 2,
            type: "guide",
            icon: "fa-solid fa-book-open",
            badge: "GUIDE UPDATE",
            title: "Fuel Guide Updated",
            summary: "New pricing workflow and validation process have been added.",
            date: "Yesterday",
            timeAgo: "Yesterday",
            button: "Open Guide"
        },
        {
            id: 3,
            type: "reminder",
            icon: "fa-solid fa-bell",
            badge: "REMINDER",
            title: "Quarter-End Validation",
            summary: "Please complete all pending validations before Friday.",
            date: "Friday",
            timeAgo: "2 hours ago",
            button: "View Details"
        }
    ];

    let current = 0;

function getGreeting(){

    const hour = new Date().getHours();

    if(hour < 12){

        return "☀ Good Morning";

    }

    if(hour < 18){

        return "🌤 Good Afternoon";

    }

    return "🌙 Good Evening";

}
    
function render() {

    const b = bulletins[current];

    root.innerHTML = `
        <div class="spotlight-card ${b.type}" id="spotlightCard">

            <div class="spotlight-progress">
                <div class="spotlight-progress-fill"></div>
            </div>

            <div class="spotlight-header">

                <div>

                    <div class="spotlight-greeting">
                        ${getGreeting()}
                    </div>

                    <div class="spotlight-subtitle">
                        Latest Updates
                    </div>

                </div>

                <div class="spotlight-count">

                    ${current + 1} / ${bulletins.length}

                </div>

            </div>

            <div class="spotlight-content">

                <div class="spotlight-badge ${b.type}">
                    <i class="${b.icon}"></i>
                    ${b.badge}
                </div>

                <h2>${b.title}</h2>

                <p>${b.summary}</p>

            </div>

            <div class="spotlight-bottom">

                <div class="spotlight-published">

                    <i class="fa-regular fa-clock"></i>

                    ${b.timeAgo}

                </div>

                <div class="spotlight-dots">

                    ${bulletins.map((x,i)=>`
                        <span class="${i===current?'active':''}"></span>
                    `).join("")}

                </div>

            </div>

        </div>
    `;

}

    render();

})();
