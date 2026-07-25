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

    function render() {

        const b = bulletins[current];

        root.innerHTML = `
        <div class="spotlight-card ${b.type}">

            <div class="spotlight-header">

                <div class="spotlight-title">

                    <i class="fa-solid fa-bullhorn"></i>

                    Enterprise Spotlight

                </div>

                <div class="spotlight-live">

                    LIVE

                </div>

            </div>

            <div class="spotlight-body">

                <div class="spotlight-badge">

                    <i class="${b.icon}"></i>

                    ${b.badge}

                </div>

                <h2>${b.title}</h2>

                <p>${b.summary}</p>

                <div class="spotlight-date">

                    <i class="fa-regular fa-calendar"></i>

                    ${b.date}

                </div>

            </div>

            <div class="spotlight-footer">

                <div class="progress">

                    <div class="progress-fill"></div>

                </div>

                <div class="spotlight-controls">

                    <button id="spotPrev">

                        <i class="fa-solid fa-chevron-left"></i>

                    </button>

                    <div class="spotlight-dots">

                        ${bulletins.map((x,i)=>
                            `<span class="${i===current?'active':''}"></span>`
                        ).join("")}

                    </div>

                    <button id="spotNext">

                        <i class="fa-solid fa-chevron-right"></i>

                    </button>

                </div>

                <button class="spotlight-button">

                    ${b.button}

                </button>

                <div class="spotlight-time">

                    ${b.timeAgo}

                </div>

            </div>

        </div>
        `;

        document.getElementById("spotPrev").onclick = prev;
        document.getElementById("spotNext").onclick = next;

    }

    function next(){

        current++;

        if(current>=bulletins.length)
            current=0;

        render();

    }

    function prev(){

        current--;

        if(current<0)
            current=bulletins.length-1;

        render();

    }

    render();

})();
