import React from "react";
import styles from "../../sass/ProjectLeaderDashboard.module.scss";
import ProjectTeamMemberRow from "./ProjectTeamMemberRow";

const ProjectTeamMemberTable = ({ projectTeamMembers }) => {
    const gDriveClickHandler  = (email) => {
        const bodyObject = {
            // temporary placeholder email
            email: "mbirdyw@gmail.com",
            file: "10_KYe3pbZqiq6reeLA8zDDeIlz-4PxWM",
        };
        fetch("api/grantpermission/googleDrive", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(bodyObject),
        })
            .then((res) => {
                if (res.status !== 200) {
                    return res.json().then((res) => {
                        throw new Error(res.message);
                    });
                }
                return res.json();
            })
            .then((res) => {
                console.log(res);
            })
            .catch((err) => {
                console.log(err);
            });
    };

    const gitHubClickHandler = (githubHandle, projectName, accessLevel = 'manager') => {
        // ******************** pbtag -- allow PL to add githubHandle if not
        // already there 
        // if (!githubHandle) {
        // }

        const bodyObject = {
            // temporary placeholder handle + repoName
            handle: "testingphoebe",
            teamName: "vrms", //projectName, no where to pull that from currently, event object doesn't provide project name
            accessLevel
        };
        fetch("api/grantpermission/gitHub", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(bodyObject),
        })
            .then((res) => {
                if (res.status !== 200) {
                    return res.json().then((res) => {
                        throw new Error(res.message);
                    });
                }
                return res.json();
            })
            .then((res) => {
                console.log(res);
            })
            .catch((err) => {
                console.log(err);
            });
    };

    return (
        <div className={styles.attendeeTable}>
            <div className={styles.attendeeTableBoxLeft}>
                <span className={styles.attendeeTableTitle}>name</span>
            </div>
            <div className={styles.attendeeTableBoxCenter}>
                <span className={styles.attendeeTableTitle}>role</span>
            </div>
            <div className={styles.attendeeTableBoxCenter}>
                <span className={styles.attendeeTableTitle}>here?</span>
            </div>

            {projectTeamMembers.map((projectTeamMember, index) => {
              const { onProjectGithub, onProjectGoogleDrive } = projectTeamMember;
                return (
                  <ProjectTeamMemberRow
                    key={index}
                    name={projectTeamMember.name}
                    role={projectTeamMember.roleOnProject}
                    onboardingStatus={{
                      isComplete: onProjectGithub && onProjectGoogleDrive,
                      githubComplete: onProjectGithub,
                      gDriveComplete: onProjectGoogleDrive
                    }}
                  ></ProjectTeamMemberRow>
                )
            })}
        </div>
    );
};

export default ProjectTeamMemberTable;
