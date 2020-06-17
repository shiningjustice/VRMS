import React, { Fragment } from "react";
import styles from "../../sass/ProjectLeaderDashboard.module.scss";
import DashboardButton from "./DashboardButton";


const ProjectTeamMemberRow = ({ name, role, onboardingStatus, gDriveClicked, gitHubClicked }) => {
    let here = null;

    if (onboardingStatus.isComplete) {
        here = <span>Complete</span>
    } else {
        const { gitHubComplete, gDriveComplete } = onboardingStatus;
        const checkmarkDiv = <div>'checkmark'</div>

        here = (
            <>
                {gitHubComplete ? <DashboardButton clicked={gitHubClicked}>'githubIcon'</DashboardButton> : checkmarkDiv}
                {gDriveComplete ? <DashboardButton clicked={gDriveClicked}>'gDriveIcon'</DashboardButton> : checkmarkDiv}
                <DashboardButton>'slackIcon'</DashboardButton>
            </>
        );
    }

    return (
        <Fragment>
            <div className={styles.attendeeTableBoxLeft}>
                <div className={styles.attendeeTableText}>{name}</div>
            </div>
            <div className={styles.attendeeTableBoxCenter}>
                <span className={styles.attendeeTableText}>{role}</span>
            </div>
            <div className={styles.attendeeTableBoxCenter}>{here}</div>
        </Fragment>
    );
};

export default ProjectTeamMemberRow;
